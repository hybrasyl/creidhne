/**
 * The page that edits each index type, by the page key that PageRenderer uses.
 * A report that names a file opens it on this page (HTOO-625).
 * `openFileSites.test.js` reads every file-backed page and checks that its
 * type is here, under the key that PageRenderer gives that page.
 */
export const PAGE_FOR_TYPE = {
  castables: 'castables',
  creaturebehaviorsets: 'behaviors',
  creatures: 'creatures',
  elementtables: 'elements',
  items: 'items',
  localizations: 'strings',
  lootsets: 'loot',
  nations: 'nations',
  npcs: 'npcs',
  recipes: 'recipes',
  serverconfigs: 'serverconfig',
  spawngroups: 'spawngroups',
  species: 'species',
  statuses: 'statuses',
  traits: 'traits',
  variantgroups: 'variants'
}
