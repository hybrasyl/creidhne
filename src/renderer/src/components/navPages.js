import {
  GiRadialBalance,
  GiMagicSwirl,
  GiDervishSwords,
  GiPoisonBottle,
  GiFaceToFace,
  GiSpiderFace,
  GiBrainTentacle,
  GiSpellBook,
  GiCastle,
  GiFingerPrint,
  GiVitruvianMan,
  GiHiveMind,
  GiGoldStack,
  GiMirrorMirror,
  GiWindHole,
  GiWok,
  GiTalk,
  GiMagickTrick,
  GiPotionBall,
  GiCalculator,
  GiPull,
  GiBootKick,
  GiConversation,
  GiDoubleDiaphragm,
  GiSettingsKnobs
} from 'react-icons/gi'
import { GO_PAGES } from '@shared/appMenu.js'

// The nav bar's pages, from the macOS Go menu's list (GO_PAGES), so the bar
// and the menu cannot disagree. GO_PAGES is in groups, split by `null`.
//
// The XML pages stay on the bar as buttons: Dashboard and the editors, which
// are every group but the last. The last group (the tools) and Settings are
// one More button with a menu, so the bar fits the window's minimum width of
// 1024px. Before, 27 buttons ran off the right side of the window.

/** The icon of each page. `macosSources.test.js` checks it against GO_PAGES. */
export const NAV_ICONS = {
  dashboard: GiRadialBalance,
  castables: GiMagicSwirl,
  items: GiDervishSwords,
  statuses: GiPoisonBottle,
  npcs: GiFaceToFace,
  creatures: GiSpiderFace,
  behaviors: GiBrainTentacle,
  spellbooks: GiSpellBook,
  nations: GiCastle,
  traits: GiFingerPrint,
  species: GiVitruvianMan,
  spawngroups: GiHiveMind,
  loot: GiGoldStack,
  variants: GiMirrorMirror,
  elements: GiWindHole,
  recipes: GiWok,
  strings: GiTalk,
  serverconfig: GiMagickTrick,
  formulas: GiPotionBall,
  'damage-calculator': GiCalculator,
  helpers: GiPull,
  dialogs: GiConversation,
  exports: GiBootKick,
  constants: GiDoubleDiaphragm,
  settings: GiSettingsKnobs
}

function groups(list) {
  const out = [[]]
  for (const entry of list) {
    if (entry === null) out.push([])
    else out[out.length - 1].push(entry)
  }
  return out.filter((g) => g.length)
}

const GROUPS = groups(GO_PAGES)

/** The pages that are buttons on the bar, in order. */
export const BAR_PAGES = GROUPS.slice(0, -1).flat()

/** The pages in the More menu, as groups: the tools, then Settings. */
export const MENU_GROUPS = [GROUPS[GROUPS.length - 1], [{ page: 'settings', label: 'Settings' }]]

/** Each page in the More menu. */
export const MENU_PAGES = MENU_GROUPS.flat()
