import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  isRemoteSession,
  resolveGpuOverride,
  shouldDisableHardwareAcceleration,
  REMOTE_SESSION_CSS
} from '../remoteSession.js'

/**
 * HTOO-325. The functions read their arguments rather than `process`, so every case
 * here is a plain call with no `process.env` mutation and no ordering between tests.
 */

// ─── isRemoteSession ─────────────────────────────────────────────────────────

describe('isRemoteSession', () => {
  it('is false off Windows, whatever the variable says', () => {
    // `SESSIONNAME` is a Windows variable. Reading it on Linux or macOS would act on
    // something anyone can set on a platform that never sets it.
    expect(isRemoteSession('linux', 'RDP-Tcp#0')).toBe(false)
    expect(isRemoteSession('darwin', 'RDP-Tcp#0')).toBe(false)
  })

  it('reads an RDP session name as remote', () => {
    expect(isRemoteSession('win32', 'RDP-Tcp#0')).toBe(true)
    expect(isRemoteSession('win32', 'RDP-Tcp#47')).toBe(true)
  })

  it('reads Console as local, whatever its casing', () => {
    // A strict compare fails in the bad direction: a `console` spelled any other way
    // would drop a LOCAL session to software rendering.
    expect(isRemoteSession('win32', 'Console')).toBe(false)
    expect(isRemoteSession('win32', 'console')).toBe(false)
    expect(isRemoteSession('win32', 'CONSOLE')).toBe(false)
  })

  it('treats an absent session name as local', () => {
    // Absent in some service and scheduled-task launch contexts. The safe default
    // there is to change nothing: a wrongly-disabled GPU on a local session is a
    // slower app in a state nobody asked for and nobody can see the cause of.
    expect(isRemoteSession('win32', undefined)).toBe(false)
    expect(isRemoteSession('win32', '')).toBe(false)
  })

  it('believes the live system metric in BOTH directions', () => {
    // `GetSystemMetrics(SM_REMOTESESSION)` cannot go stale, so it outranks the
    // variable — including when it says "not remote" against a variable claiming
    // otherwise, which is the direction easy to get wrong.
    expect(isRemoteSession('win32', 'Console', true)).toBe(true)
    expect(isRemoteSession('win32', 'RDP-Tcp#0', false)).toBe(false)
  })

  it('falls through to the variable when the metric has no opinion', () => {
    // `null` is "no opinion", not "not remote". Nothing supplies this parameter in
    // Creidhne today, so this is the live path.
    expect(isRemoteSession('win32', 'RDP-Tcp#0', null)).toBe(true)
    expect(isRemoteSession('win32', 'Console', null)).toBe(false)
  })

  it('is wrong on a reconnected session, which is why the override exists', () => {
    // Windows writes SESSIONNAME at logon and never revises it. RDP into a machine
    // that already has a console session and Windows RECONNECTS it, so every process
    // keeps reporting `Console` while running over RDP — measured by epona with
    // `query session` showing `rdp-tcp#0 Active`. That is anyone who leaves a machine
    // logged in and connects later, so it is the common case rather than a corner.
    // This test pins the limitation rather than a fix: the answer is the env override
    // below, or a native metric wired into the third parameter.
    expect(isRemoteSession('win32', 'Console')).toBe(false)
    expect(shouldDisableHardwareAcceleration('win32', { SESSIONNAME: 'Console' })).toBe(false)
    expect(
      shouldDisableHardwareAcceleration('win32', {
        SESSIONNAME: 'Console',
        CREIDHNE_DISABLE_GPU: '1'
      })
    ).toBe(true)
  })
})

// ─── resolveGpuOverride ──────────────────────────────────────────────────────

describe('resolveGpuOverride', () => {
  it('is null for unset and for empty', () => {
    // Empty must mean unset, not off: `set CREIDHNE_DISABLE_GPU=` is how a shell
    // clears a variable, and reading that as "force the GPU on" would make clearing
    // the override set it in the other direction.
    expect(resolveGpuOverride(undefined)).toBeNull()
    expect(resolveGpuOverride('')).toBeNull()
  })

  it('reads 0 as off', () => {
    expect(resolveGpuOverride('0')).toBe(false)
  })

  it('reads anything else as on, rather than falling through to detection', () => {
    // One rule instead of a list of accepted spellings. An unrecognised value must
    // NOT fall through, which would read as an override that silently did nothing.
    expect(resolveGpuOverride('1')).toBe(true)
    expect(resolveGpuOverride('true')).toBe(true)
    expect(resolveGpuOverride('yes')).toBe(true)
    expect(resolveGpuOverride('banana')).toBe(true)
  })
})

// ─── shouldDisableHardwareAcceleration ───────────────────────────────────────

describe('shouldDisableHardwareAcceleration', () => {
  it('lets the override win over detection, in both directions', () => {
    // Forcing it ON is how the remote branch gets exercised on a machine with no RDP
    // access, which is most machines. Forcing it OFF is a user's only recourse if
    // detection is wrong on their box, since there is deliberately no UI toggle.
    expect(
      shouldDisableHardwareAcceleration('win32', {
        SESSIONNAME: 'Console',
        CREIDHNE_DISABLE_GPU: '1'
      })
    ).toBe(true)
    expect(
      shouldDisableHardwareAcceleration('win32', {
        SESSIONNAME: 'RDP-Tcp#0',
        CREIDHNE_DISABLE_GPU: '0'
      })
    ).toBe(false)
  })

  it('honours the override off Windows too', () => {
    // The override is about software compositing, which is not a Windows-only state.
    // `isRemoteSession` short-circuits on platform; this must not.
    expect(shouldDisableHardwareAcceleration('linux', { CREIDHNE_DISABLE_GPU: '1' })).toBe(true)
  })

  it('falls back to detection when the override is unset', () => {
    expect(shouldDisableHardwareAcceleration('win32', { SESSIONNAME: 'RDP-Tcp#0' })).toBe(true)
    expect(shouldDisableHardwareAcceleration('win32', { SESSIONNAME: 'Console' })).toBe(false)
    expect(shouldDisableHardwareAcceleration('win32', {})).toBe(false)
  })

  it('is a decision, so isRemoteSession stays a claim about the world', () => {
    // The two are separate on purpose. `isRemoteSession` must not start answering
    // `true` for a machine that is plainly local, or every later reader is misled by a
    // debugging flag. Epona hit exactly this and split a third export out for it.
    const env = { SESSIONNAME: 'Console', CREIDHNE_DISABLE_GPU: '1' }
    expect(shouldDisableHardwareAcceleration('win32', env)).toBe(true)
    expect(isRemoteSession('win32', env.SESSIONNAME)).toBe(false)
  })

  it('takes a real process.env without special handling', () => {
    // The one argument this function was written for. Asserted as a type-free smoke
    // check: whatever this machine is, the call must return a boolean rather than
    // throwing on a missing key.
    expect(typeof shouldDisableHardwareAcceleration(process.platform, process.env)).toBe('boolean')
  })
})

// ─── REMOTE_SESSION_CSS ──────────────────────────────────────────────────────

describe('REMOTE_SESSION_CSS', () => {
  it('kills the backdrop filter, both spellings', () => {
    expect(REMOTE_SESSION_CSS).toMatch(/backdrop-filter:\s*none\s*!important/)
    expect(REMOTE_SESSION_CSS).toMatch(/-webkit-backdrop-filter:\s*none\s*!important/)
  })

  it('does not touch text-shadow, because Creidhne’s themes declare none', () => {
    // Narrower than epona's rule, and measured rather than copied: epona kills
    // text-shadow because its themes carry shadows widely. Creidhne's six declare
    // none — the only ones in the app are the title-bar wordmark and one line in the
    // multi-select overlay. Two elements are not a repaint cost worth a global
    // `!important`, and a rule that changes how the app looks should earn it.
    expect(REMOTE_SESSION_CSS).not.toMatch(/text-shadow/)
    expect(REMOTE_SESSION_CSS).not.toMatch(/font-smooth/)
  })

  it('is the mitigation the themes actually need', () => {
    // Not decoration: four of the six themes put backdropFilter on MuiPaper.root,
    // which backs Card, Dialog, Accordion and Menu. If that ever stops being true
    // this rule is dead weight — and if a seventh theme adds one, the rule already
    // covers it, because it is unconditional.
    for (const name of ['chadul', 'danaan', 'grinneal', 'hybrasyl']) {
      const src = readFileSync(
        join(import.meta.dirname, '..', '..', 'renderer', 'src', 'themes', `${name}.js`),
        'utf8'
      )
      expect(src, `${name} no longer declares a backdrop blur`).toMatch(/backdropFilter/)
    }
  })

  it('is not needed by the two themes that carry no blur', () => {
    // The corporate pair. Pinned so "four of six" stays a measurement rather than a
    // remembered number: if one of these grows a blur, the claim above is stale even
    // though the rule still covers it.
    for (const name of ['mundanes', 'dubhaimid']) {
      const src = readFileSync(
        join(import.meta.dirname, '..', '..', 'renderer', 'src', 'themes', `${name}.js`),
        'utf8'
      )
      expect(src, `${name} has grown a backdrop blur`).not.toMatch(/backdropFilter/)
    }
  })
})

// ─── the call-site position ──────────────────────────────────────────────────

describe('the call-site position in index.js', () => {
  // `app.disableHardwareAcceleration()` after the `ready` event does not throw and
  // does not warn in a way anybody reads — it simply stops working. So a later boot
  // reordering would leave the module, these tests and the card all describing a fix
  // that is no longer happening, with every gate green. This is the only guard that
  // can see it.
  const INDEX = join(import.meta.dirname, '..', 'index.js')

  /**
   * Comments stripped before measuring.
   *
   * **Measured on Creidhne's file rather than assumed either way.** The raw file
   * would pass too, because nothing above the call happens to name `whenReady`.
   * Epona's does not — it measured `whenReady` at offset 2363 inside a comment
   * against the call at 3838, so the naive assertion FAILS there on correct code, and
   * a test that fails on a correct file gets deleted rather than fixed.
   *
   * The stripping is kept because the order in which prose and code mention a symbol
   * is not a property anybody maintains. One comment added above the call that
   * mentions `whenReady` would turn this guard into a false alarm, and a false alarm
   * on a silent-failure guard is how the guard gets removed.
   */
  function codeOnly() {
    return readFileSync(INDEX, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  it('disables hardware acceleration before app.whenReady()', () => {
    const code = codeOnly()
    const disable = code.indexOf('app.disableHardwareAcceleration()')
    const ready = code.indexOf('app.whenReady()')
    expect(disable, 'the call is gone from index.js').toBeGreaterThan(-1)
    expect(ready, 'app.whenReady() is gone from index.js').toBeGreaterThan(-1)
    expect(disable).toBeLessThan(ready)
  })

  it('strips comments, so prose above the call cannot invert the measurement', () => {
    // Pins the helper's behaviour rather than a claim about today's file. The
    // assertion above reads offsets out of source, so a comment mentioning
    // `whenReady` above the call would break it on correct code — which is what
    // happened to epona. The stripper is what makes that impossible.
    const stripped = codeOnly()
    expect(stripped).not.toMatch(/MUST be here, before the `ready` event/)
    expect(stripped).toContain('app.disableHardwareAcceleration()')
  })

  it('takes the single-instance lock before it too, which has the same silent failure', () => {
    // `app.setPath('userData', …)` and the lock keyed on it share this shape: both are
    // no-ops after ready rather than errors. All three sit within a few lines, so one
    // reordering breaks them together.
    const code = codeOnly()
    expect(code.indexOf("app.setPath('userData'")).toBeLessThan(
      code.indexOf('app.requestSingleInstanceLock()')
    )
    expect(code.indexOf('app.requestSingleInstanceLock()')).toBeLessThan(
      code.indexOf('app.whenReady()')
    )
  })

  it('keys the CSS injection to the decision, not to detection', () => {
    // `CREIDHNE_DISABLE_GPU=1` on a local machine puts compositing on the CPU just as
    // surely as RDP does, and the blur is expensive for that reason rather than
    // because the session is remote. Keying the CSS to `isRemoteSession` would make
    // the repro flag reproduce only half the condition it exists to reproduce.
    const code = codeOnly()
    expect(code).toMatch(/shouldDisableHardwareAcceleration\(process\.platform,\s*process\.env\)/)
    expect(code).toMatch(/if \(softwareRendering\) \{[\s\S]*?REMOTE_SESSION_CSS/)
    expect(code, 'the CSS is keyed to detection rather than the decision').not.toMatch(
      /isRemoteSession\([\s\S]*?REMOTE_SESSION_CSS/
    )
  })
})
