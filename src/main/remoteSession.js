/**
 * Remote-session detection, and the mitigation that hangs off it.
 *
 * A Remote Desktop session has no GPU. Windows attaches the Microsoft Remote
 * Display Adapter, so Chromium rasterises in software while still paying for GPU
 * compositing, and every repaint is then captured and encoded by RDP itself.
 * Creidhne is frameless, so window dragging goes through Chromium's app-region hit
 * testing rather than a native title bar — the more expensive path under exactly
 * these conditions. Reported against epona over RDP, 2026-08-07 (HTOO-325); filed
 * against the template because every app cut from it inherits the gap.
 *
 * **Detection rather than a setting, and that is the card's decision rather than a
 * preference.** `app.disableHardwareAcceleration()` must run before the `ready`
 * event; Creidhne loads settings through `fs.promises` with no synchronous path, so
 * a persisted toggle would need a new sync read of `settings.json` at module load,
 * racing `migrateSettingsFromRoaming`. Detecting the environment costs no schema
 * change, no store action, no UI and no migration ordering hazard. A UI toggle is
 * explicitly not wanted: the app should adapt rather than ask.
 *
 * **Pure, and it reads its arguments rather than `process`.** The call site in
 * `index.js` supplies them, so every test case is a plain function call with no
 * `process.env` mutation. The shape is epona's, which balor and Taliesin reached
 * independently — three authors refused the inline sketch in the card body, which is
 * the strongest argument there is for this form.
 */

/**
 * Is this process running in a Remote Desktop session?
 *
 * Two signals, in priority order, and the ordering is the whole point.
 *
 * **`systemRemoteSession` is `GetSystemMetrics(SM_REMOTESESSION)`** — a live query
 * that cannot go stale — and it is believed in **both** directions when present.
 * `null` means "no opinion", which falls through to the environment variable rather
 * than being read as "not remote".
 *
 * **`sessionName` is `%SESSIONNAME%`, and it LIES after a reconnect.** Windows
 * writes it at logon and never revises it, so RDP-ing into a machine that already
 * has your session open at the console — which *reconnects* that session rather
 * than creating a new one — leaves every process reporting `Console` over RDP.
 * Measured by epona on a test machine: `SESSIONNAME=Console` with `query session`
 * showing `rdp-tcp#0 Active`. `CLIENTNAME` goes stale identically and is no help.
 * That is what happens to anyone who leaves a machine logged in and later connects
 * to it remotely, so it is the common case rather than a corner, and it makes the
 * env-only version inert for exactly the users the card was written for.
 *
 * **Nothing supplies `systemRemoteSession` in Creidhne today, and that is a
 * deliberate stop rather than an oversight.** Epona reads it through `da-win32`,
 * which it already loads on Windows for the Legacy tab — so there it adds a load
 * rather than a dependency. Creidhne loads no native module at all, and taking this
 * signal would mean adding one to the pre-`ready` boot path for a single integer.
 * The parameter is here, and tested, so wiring a native probe later is a change at
 * the call site rather than a change to the rule. Until then
 * `CREIDHNE_DISABLE_GPU=1` is the answer for a user whose session reconnects, which
 * is a large part of why the override exists.
 *
 * Neither signal detects Parsec, Sunshine, VNC or other non-RDP remote tools, and
 * `SESSIONNAME` is a Windows variable, so xrdp, X2Go and Wayland-remote get
 * nothing.
 *
 * @param {string} platform
 * @param {string | undefined} sessionName
 * @param {boolean | null} systemRemoteSession
 * @returns {boolean}
 */
export function isRemoteSession(platform, sessionName, systemRemoteSession = null) {
  if (platform !== 'win32') return false
  // Authoritative when we have it, INCLUDING when it says no. A live "not remote"
  // beats a stale environment variable claiming otherwise.
  if (typeof systemRemoteSession === 'boolean') return systemRemoteSession
  // Unset is treated as LOCAL. `SESSIONNAME` is absent in some service and
  // scheduled-task launch contexts, and the safe default there is to change
  // nothing: a wrongly-disabled GPU on a local session is a slower app in a state
  // nobody asked for and nobody can see the cause of.
  if (!sessionName) return false
  // Case-folded rather than compared exactly. The failure direction of a strict
  // compare is the bad one — a `console` spelled any other way would drop a LOCAL
  // session to software rendering.
  return sessionName.toLowerCase() !== 'console'
}

/**
 * Read the `CREIDHNE_DISABLE_GPU` escape hatch. `true` forces software rendering,
 * `false` forces acceleration back on, `null` means "not set — decide by
 * detection".
 *
 * It answers in **both** directions on purpose, and the direction that is easy to
 * forget is the more useful one. Forcing it ON is how the remote-session branch gets
 * exercised on a machine with no RDP access, which is most machines. Forcing it OFF
 * is a user's only recourse if detection is ever wrong on their box — precisely
 * because there is deliberately no UI toggle.
 *
 * One rule rather than a list of accepted spellings: empty or unset is unset, `0` is
 * off, anything else is on. **An unrecognised value must not fall through to
 * detection**, which would read as an override that silently did nothing.
 *
 * @param {string | undefined} value
 * @returns {boolean | null}
 */
export function resolveGpuOverride(value) {
  if (typeof value !== 'string' || value === '') return null
  return value !== '0'
}

/**
 * The decision: should this process disable hardware acceleration?
 *
 * Kept separate from `isRemoteSession` rather than folded into it. That function's
 * name is a **claim about the world** — it must not start answering `true` for a
 * machine that is plainly local, or every later reader is misled by a debugging
 * flag. This one is named for the decision, so the override sits inside it honestly.
 * Epona hit exactly this and split a third export out to solve it.
 *
 * @param {string} platform
 * @param {Record<string, string | undefined>} env
 * @param {boolean | null} systemRemoteSession
 * @returns {boolean}
 */
export function shouldDisableHardwareAcceleration(platform, env, systemRemoteSession = null) {
  const override = resolveGpuOverride(env.CREIDHNE_DISABLE_GPU)
  if (override !== null) return override
  return isRemoteSession(platform, env.SESSIONNAME, systemRemoteSession)
}

/**
 * Injected into the main window when software rendering is in force.
 *
 * Four of Creidhne's six themes put `backdropFilter: blur(2px)` on `MuiPaper.root`
 * — chadul, danaan, grinneal and hybrasyl — which backs Card, Dialog, Accordion and
 * Menu. A blur makes Chromium read back everything behind the surface and blur it on
 * every repaint, including every frame of a drag. With a GPU that is nearly free;
 * under software compositing it is not. Disabling the GPU and leaving the blur in
 * place would be half a fix — balor shipped exactly that and had to come back for it
 * (HTOO-327).
 *
 * **Keyed to the DECISION, not to detection.** `CREIDHNE_DISABLE_GPU=1` on a local
 * machine puts compositing on the CPU just as surely as RDP does, and the blur is
 * expensive for that reason rather than because the session is remote. Keying it to
 * detection would make the repro flag reproduce only half the condition it exists to
 * reproduce.
 *
 * **Narrower than epona's, and measured rather than copied.** Epona also kills
 * `text-shadow` and forces antialiased smoothing, because its themes carry text
 * shadows widely. Creidhne's six themes declare none: the only `textShadow` in the
 * app is the title-bar wordmark, already dropped on the two corporate themes, and one
 * line in the multi-select overlay. Two elements' shadows are not a repaint cost
 * worth a global `!important`, and a rule that changes how the app looks should earn
 * it.
 *
 * A runtime injection rather than a theme edit: it reverts by simply not being
 * injected, and the themes stay one description of how the app looks. `dom-ready`
 * fires before first paint, so there is no flash of the blurred style.
 *
 * **Unconditional across themes on purpose.** It is a no-op where there is no blur,
 * which is what makes a mid-session theme switch need no second decision — and a
 * rule with no exceptions cannot be applied to the wrong half of a six-theme set by a
 * later author adding a seventh.
 */
export const REMOTE_SESSION_CSS = `
  * {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
`
