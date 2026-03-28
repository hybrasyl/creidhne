import { CLASS_TYPES } from './itemConstants';

export const CASTABLE_BOOKS = [
  'PrimarySkill', 'PrimarySpell', 'SecondarySkill', 'SecondarySpell', 'UtilitySkill', 'UtilitySpell',
];

export const CASTABLE_DESCRIPTION_CLASSES = ['Peasant', 'Warrior', 'Rogue', 'Wizard', 'Priest', 'Monk'];

export const CASTABLE_COST_TYPES = ['Hp', 'Mp', 'Gold', 'Item'];

export const SPELL_USE_TYPES = [
  'Unusable', 'Prompt', 'Target', 'FourDigit', 'ThreeDigit', 'NoTarget', 'TwoDigit', 'OneDigit',
];

export const INTENT_FLAGS = ['Hostile', 'Friendly', 'Pvp', 'Group', 'Self'];

export const INTENT_DIRECTIONS = ['None', 'Front', 'Back', 'Left', 'Right'];

export const VISUAL_EFFECT_TYPES = ['Targets', 'AllTiles', 'Caster'];

export const DAMAGE_FLAGS = ['None', 'NoResistance', 'NoThreat', 'Nonlethal', 'NoDodge', 'NoCrit', 'NoElement'];
export const DAMAGE_TYPES = ['Direct', 'Physical', 'Magical', 'Elemental'];

export const MASTERY_MODIFIERS = ['Damage', 'Heal', 'MissRate', 'FailRate'];

export const DEFAULT_INTENT = {
  useType:    'NoTarget',
  maxTargets: '',
  flags:      [],
  map:        false,
  crosses:    [],
  cones:      [],
  squares:    [],
  lines:      [],
  tiles:      [],
};

export const ALL_CASTABLE_CLASSES = CLASS_TYPES.filter((c) => c !== 'All');
// ['Peasant', 'Warrior', 'Rogue', 'Wizard', 'Priest', 'Monk']

const _ALL_CLASS_SET = new Set(ALL_CASTABLE_CLASSES);
export function isAllClasses(classStr) {
  const parts = (classStr || '').split(' ').filter(Boolean);
  return parts.length === _ALL_CLASS_SET.size && parts.every((c) => _ALL_CLASS_SET.has(c));
}

export const DEFAULT_REQUIREMENT = {
  class: '', forbidCookie: '', requireCookie: '',
  levelMin: '', levelMax: '',
  abMin:    '', abMax:    '',
  gold: '',
  str: '3', int: '3', wis: '3', con: '3', dex: '3',
  items: [],
  prerequisites: {
    deprecated:     true,
    forbidCookie:   '', forbidMessage:  '',
    requireCookie:  '', requireMessage: '',
    castables: [],
  },
};

export const DEFAULT_CASTABLE = {
  name: '',
  lines: '',
  cooldown: '',
  icon: '',
  book: 'PrimarySkill',
  elements: 'None',
  class: ALL_CASTABLE_CLASSES.join(' '),
  reflectable: false,
  breakStealth: false,
  includeInMetafile: false,
  descriptions: [],
  categories: [],
  castCosts: [],
  intents: [],
  maxLevel: { deprecated: false, monk: '', warrior: '', peasant: '', wizard: '', priest: '', rogue: '' },
  script: '',
  sound: { id: '' },
  animations: {
    onCast: {
      player: { peasant:{id:'1',speed:'20'}, warrior:{id:'1',speed:'20'}, wizard:{id:'1',speed:'20'}, priest:{id:'1',speed:'20'}, rogue:{id:'1',speed:'20'}, monk:{id:'1',speed:'20'} },
      target: { id:'', speed:'' },
    },
    onEnd: {
      player: { peasant:{id:'1',speed:'20'}, warrior:{id:'1',speed:'20'}, wizard:{id:'1',speed:'20'}, priest:{id:'1',speed:'20'}, rogue:{id:'1',speed:'20'}, monk:{id:'1',speed:'20'} },
      target: { id:'', speed:'' },
    },
  },
  scriptOverride: false,
  heal:    null,
  damage:  null,
  statuses: { add: [], remove: [] },
  mastery: { deprecated: false, uses: '', modifiers: [], tiered: false },
  requirements: [],
  restrictions: [],
  reactors: [],
};

export function computeCastableFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `${safe}.xml`;
}

export const BOOK_ABBREVS = {
  PrimarySkill:   'psk',
  PrimarySpell:   'psp',
  SecondarySkill: 'ssk',
  SecondarySpell: 'ssp',
  UtilitySkill:   'usk',
  UtilitySpell:   'usp',
};

export function derivePrefix(classValue, book) {
  const classes = (classValue || '').split(' ').filter(Boolean);
  const classPart = classes.length === 1
    ? classes[0].toLowerCase()
    : classes.length === ALL_CASTABLE_CLASSES.length ? 'all' : '';
  const bookPart = BOOK_ABBREVS[book] || '';
  if (classPart && bookPart) return `${classPart}_${bookPart}`;
  return classPart || bookPart;
}
