import { spawn as nodeSpawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'

// Open a world script in VS Code (HTOO-680).
//
// The old handler ran `code` through a command shell (`shell: true`) so that
// Windows found `code.cmd`. The script path is world text, and a file name may
// hold shell syntax such as `$(...)`, `&` or `|`, so a click on Open could run a
// command. Now nothing goes through a command interpreter: main finds the VS Code
// program itself and starts it with an argument array.
//
// - Windows: `code.cmd` is a batch file, which Node refuses to start without a
//   shell. Main finds `code.cmd` on PATH and starts the `Code.exe` beside it, one
//   folder up. `Code.exe` takes the same arguments as the `code` command.
// - macOS and Linux: `code` on PATH is an executable script; it starts directly.
//
// When main finds no VS Code, the OS default program opens the file.

/**
 * The VS Code program to start, or null. `exists` and `env` are injected so the
 * tests can drive each platform.
 */
export function resolveVsCode({ platform, env, exists = existsSync }) {
  const dirs = String(env?.PATH ?? env?.Path ?? '')
    .split(platform === 'win32' ? ';' : ':')
    .filter(Boolean)
  for (const dir of dirs) {
    if (platform === 'win32') {
      if (exists(join(dir, 'code.cmd'))) {
        const exe = join(dirname(dir), 'Code.exe')
        if (exists(exe)) return exe
      }
    } else if (exists(join(dir, 'code'))) {
      return join(dir, 'code')
    }
  }
  return null
}

/** The arguments: a new window rooted at the scripts folder, so the Lua server finds .luarc.json. */
export function vsCodeArgs(scriptsDir, scriptPath) {
  return ['--new-window', scriptsDir, '--goto', scriptPath]
}

/**
 * Start VS Code on the script, or open it with the OS default program.
 * Returns the child process when VS Code started, or null.
 */
export async function openWorldScript({
  scriptsDir,
  scriptPath,
  platform = process.platform,
  env = process.env,
  exists = existsSync,
  spawn = nodeSpawn,
  openPath
}) {
  const exe = resolveVsCode({ platform, env, exists })
  if (!exe) {
    const failReason = await openPath(scriptPath)
    if (failReason) return { ok: false, error: failReason }
    return { ok: true, path: scriptPath }
  }
  // An inherited ELECTRON_RUN_AS_NODE would make Code.exe a plain Node.
  const childEnv = { ...env }
  delete childEnv.ELECTRON_RUN_AS_NODE
  const child = spawn(exe, vsCodeArgs(scriptsDir, scriptPath), {
    shell: false,
    detached: true,
    stdio: 'ignore',
    env: childEnv
  })
  child.on?.('error', () => {
    void openPath(scriptPath)
  })
  child.unref?.()
  return { ok: true, path: scriptPath, child }
}
