import { promises as fs } from 'fs'
import { join } from 'path'

const LOG_NAME = 'ipc-validation.log'
const ROTATE_AT_BYTES = 256 * 1024

// Best-effort breadcrumb file the user can attach to a bug report when an
// IPC payload is rejected. Failures here are silently swallowed — the real
// IPC error is what the renderer needs to see.
async function logSchemaFailure(settingsPath, channel, error) {
  try {
    const path = join(settingsPath, LOG_NAME)
    try {
      const { size } = await fs.stat(path)
      if (size > ROTATE_AT_BYTES) {
        await fs.rename(path, `${path}.1`).catch(() => {})
      }
    } catch {
      /* file may not exist yet */
    }
    const issues = error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    const line = `${new Date().toISOString()} ${channel} ${issues}\n`
    await fs.mkdir(settingsPath, { recursive: true }).catch(() => {})
    await fs.appendFile(path, line, 'utf-8').catch(() => {})
  } catch {
    /* best effort */
  }
}

// Parse a renderer-supplied payload at the IPC boundary. On failure: log a
// one-line breadcrumb under settingsPath, then throw with the field path so
// the caller (and the renderer console) know why the save was refused.
export function parseOrLog(ctx, channel, schema, payload) {
  const result = schema.safeParse(payload)
  if (!result.success) {
    void logSchemaFailure(ctx.settingsPath, channel, result.error)
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid ${channel} payload: ${issues}`)
  }
  return result.data
}
