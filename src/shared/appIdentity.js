// The single per-app identity constant for the portable Report Issue / diagnostics
// module. This is the ONLY file a sibling app edits to adopt the module — every
// other module file is drop-in.
//
// All house apps point `intakeOwner`/`intakeRepo` at the SAME public intake repo
// (hybrasyl/cernunnos); only `productName` + `appLabel` differ. The label is what
// lets maintainers triage/move issues by their source app.
//
// Keep this file free of electron/node imports — it is pulled from main, preload,
// and renderer alike, and mirrors the TS template's src/shared/ contract.
export const appIdentity = {
  productName: 'Creidhne',
  intakeOwner: 'hybrasyl',
  intakeRepo: 'cernunnos',
  appLabel: 'app:creidhne',
  homepage: 'https://github.com/hybrasyl/creidhne'
}
