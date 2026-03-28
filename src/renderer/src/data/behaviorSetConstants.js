export const ROTATION_TYPES = ['Offense', 'Defense', 'OnDeath', 'NearDeath', 'Assail'];

export const TARGET_PRIORITY_TYPES = [
  'None', 'Self', 'AllAllies', 'RandomAlly', 'Attacker', 'HighThreat', 'LowThreat',
];

export const IMMUNITY_TYPES = [
  'Element', 'Castable', 'Status', 'StatusCategory', 'CastableCategory',
];

export const MESSAGE_TYPES = [
  'Mail', 'BoardMessage', 'Say', 'Shout', 'Whisper',
  'GuildChat', 'GroupChat', 'RegionalChat', 'GMChat',
];

export const DEFAULT_COOKIE = { name: '', value: '' };

export const DEFAULT_HOSTILITY = {
  monsters: { enabled: false, exceptCookie: '', onlyCookie: '' },
  players:  { enabled: false, exceptCookie: '', onlyCookie: '' },
};

export const DEFAULT_CASTING_SET_CASTABLE = {
  name:             '',
  healthPercentage: '',
  interval:         '',
};

export const DEFAULT_CASTING_SET = {
  type:             'Offense',
  interval:         '',
  targetPriority:   '',
  healthPercentage: '',
  random:           false,
  categories:       '',
  castables:        [],
};

export const DEFAULT_BEHAVIOR_SET = {
  name:          '',
  comment:       '',
  import:        '',
  statAlloc:     '',
  castingSets:   [],
  hostility:     { monsters: { enabled: false, exceptCookie: '', onlyCookie: '' }, players: { enabled: false, exceptCookie: '', onlyCookie: '' } },
  cookies:       [],
  immunities:    [],
  statModifiers: { rows: [], elementalModifiers: [] },
};

export function computeBehaviorSetFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `${safe}.xml`;
}
