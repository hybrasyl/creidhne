// One-time install of global renderer error forwarders. Uncaught errors and
// unhandled promise rejections are shipped to main (scrubbed + logged there),
// so they land in the same session log as main-process and React errors. Best
// effort — forwarding must never itself throw.

let installed = false

export function installRendererErrorForwarding() {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    const err = event.error
    try {
      window.electronAPI?.reportRendererError?.({
        source: 'window.onerror',
        message: err?.message
          ? `${err.name || 'Error'}: ${err.message}`
          : String(event.message || 'Error'),
        stack: err?.stack
      })
    } catch {
      /* best effort */
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const err = reason instanceof Error ? reason : null
    try {
      window.electronAPI?.reportRendererError?.({
        source: 'unhandledrejection',
        message: err ? `${err.name || 'Error'}: ${err.message}` : String(reason),
        stack: err?.stack
      })
    } catch {
      /* best effort */
    }
  })
}
