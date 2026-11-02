import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { readFileSync } from 'fs'

// The window buttons, from the main side. TitleBar.test.jsx checks that each
// button sends its channel; this checks what main does with it. It replaced a
// check by eye on the Linux box (Sabrael, 2026-11-02). The handlers are
// registered inside createWindow in index.js, which imports electron at load,
// so this reads the file as text, with comments removed.
const SRC = readFileSync(join(__dirname, '..', 'index.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

/** The body of `ipc.on('<channel>', (e) => { … })`, up to its closing `})`. */
function handler(channel) {
  const start = SRC.indexOf(`ipc.on('${channel}', (e) => {`)
  expect(start, `no ipc.on('${channel}') handler`).toBeGreaterThan(-1)
  return SRC.slice(start, SRC.indexOf('\n  })', start))
}

describe('the window-button channels', () => {
  it('minimise minimises the window that sent it', () => {
    expect(handler('minimize-window')).toMatch(
      /const window = senderWindow\(e\)\s*if \(window\) window\.minimize\(\)/
    )
  })

  it('maximise maximises, and a second press restores', () => {
    expect(handler('maximize-window')).toMatch(
      /const window = senderWindow\(e\)[\s\S]*if \(window\.isMaximized\(\)\) \{\s*window\.unmaximize\(\)\s*\} else \{\s*window\.maximize\(\)\s*\}/
    )
  })

  it('close asks the close guard of the window that sent it, not close() at once', () => {
    const body = handler('close-window')
    expect(body).toMatch(
      /const window = senderWindow\(e\)\s*if \(window\) window\.webContents\.send\('app:check-close'\)/
    )
    expect(body).not.toMatch(/\.close\(\)|\.destroy\(\)/)
  })

  it('acts on the sender, not the focused window', () => {
    expect(SRC).toMatch(/const senderWindow = \(e\) => BrowserWindow\.fromWebContents\(e\.sender\)/)
  })
})
