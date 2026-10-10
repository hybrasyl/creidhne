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
  homepage: 'https://github.com/hybrasyl/creidhne',
  // Update check (house module update-check v1, HTOO-382). The key of this app's
  // entry in cernunnos versions.json; scripts/publish-version.mjs reads it from
  // this line. Set here, not taken from package.json, so a package rename cannot
  // move the app to a key that nothing writes.
  updateKey: 'creidhne',
  // The only place the update notice may send the user. Main refuses a manifest
  // `url` outside it, so an edit to the manifest cannot point at another site.
  releaseUrlPrefix: 'https://github.com/hybrasyl/creidhne/releases/'
}
