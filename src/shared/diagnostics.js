// Pure assembly of the diagnostics block and the per-error log line. Shared by the
// main-process session logger (line format) and the report dialog (the block). No
// node/electron imports — all inputs are passed in already-scrubbed.

// Flatten a multi-line stack into one physical line so a session-log entry is one
// line and the diagnostics block stays compact. Collapses newlines + surrounding
// whitespace to " | ".
function flattenStack(stack) {
  return String(stack)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' | ')
}

/**
 * One-line rendering of a captured error entry, used for both the on-disk session
 * log and the diagnostics tail.
 * @param {{ timestamp?: string, source?: string, origin?: string, message?: string, stack?: string }} entry
 * @returns {string}
 */
export function formatErrorLine(entry = {}) {
  const { timestamp = '', source = 'error', origin = 'main', message = '', stack } = entry
  const head = `${timestamp} [${source}] ${origin} :: ${message}`.trim()
  return stack ? `${head} | ${flattenStack(stack)}` : head
}

/**
 * Build the scrubbed diagnostics block shown (editable) in the report dialog and
 * appended to the issue body.
 * @param {{ productName?: string, version?: string, os?: string, errors?: Array }} input
 * @returns {string}
 */
export function buildDiagnosticsBlock({
  productName = '',
  version = '',
  os = '',
  errors = []
} = {}) {
  const lines = [`App: ${productName} ${version}`.trim(), `OS: ${os}`]
  lines.push('--- recent errors (scrubbed) ---')
  if (!errors || errors.length === 0) {
    lines.push('No errors captured this session.')
  } else {
    for (const e of errors) lines.push(formatErrorLine(e))
  }
  return lines.join('\n')
}
