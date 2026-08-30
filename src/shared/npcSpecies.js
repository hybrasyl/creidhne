/**
 * The species an NPC can be, as the lore repo names them.
 *
 * The seed for the `npcSpecies` constants key. Drawn from the species notes in
 * loures (`hamweb/Internal Notes/2 - Species/Notes - Species - *.md`, one file
 * per species that has notes rather than an idea page), spelled the way each
 * file's heading spells the singular — "Human", "Dwarf", "Mukul" — because a
 * species field on one NPC names one of them.
 *
 * This is a SEED, not a vocabulary. `constantsJson.js` supplies it only when a
 * world's `constants.json` has no `npcSpecies` key at all, and the field's
 * autocomplete adds anything typed to that key, so a world that outgrows the
 * lore list does so without touching this file. A species removed from the
 * lore stays here until the world's own list is edited, which is the right
 * order: the world data is the record, and this list only starts it.
 */
export const DEFAULT_NPC_SPECIES = Object.freeze([
  'Aliarim',
  'Bjorin',
  'Carran',
  'Daurekh',
  'Dwarf',
  'Eirald',
  'Goblin',
  'Grimlok',
  'Human',
  'Kobold',
  'Lyrien',
  'Mioren',
  'Molgrun',
  'Mukul',
  'Murkrenn',
  'Nitharim',
  'Orc',
  'Orlen',
  'Piffin',
  'Salaman',
  'Shavren',
  'Sylarim',
  'Syrrin',
  'Triton',
  'Tzurak',
  'Valenni',
  'Veshim'
])
