import { spawn } from 'child_process'
import { promises as fs } from 'fs'

// Locks the spawn target to settings.taliesinPath so a renderer compromise
// can't spawn an arbitrary executable. Renderer-supplied exePath must match
// the value the user explicitly stored in Settings; anything else returns
// false without spawning.
export async function launchCompanion(settingsManager, exePath) {
  if (!exePath) return false
  const settings = await settingsManager.load()
  if (!settings.taliesinPath || exePath !== settings.taliesinPath) return false
  try {
    await fs.access(exePath)
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    return false
  }
}
