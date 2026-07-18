// Map Node's `process.platform` to a coarse, non-identifying OS family. Only this
// simplified token ever appears in diagnostics — never the OS build/version or arch,
// which narrow down (and can help fingerprint) an individual machine.
export function simplifyPlatform(platform) {
  switch (platform) {
    case 'win32':
      return 'windows'
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'linux'
    default:
      return 'other'
  }
}
