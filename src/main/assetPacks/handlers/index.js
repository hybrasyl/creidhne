// Content-type → handler registry. Each handler declares the manifest
// content_type it owns, its filename schema, and the subtypes (lookup
// keys) it exposes via listCoveredIds() / resolveAsset().
//
// Adding a new content type:
//   1. Create a new handler module under handlers/.
//   2. Import it here and register() it.
//   3. If its filename schema differs from the flat prefix####.png shape,
//      also add a new factory module (creatures and effects will need
//      this for multi-frame keys).

import abilityIcons from './abilityIcons.js'
import nationBadges from './nationBadges.js'
import legendMarkIcons from './legendMarkIcons.js'
import itemIcons from './itemIcons.js'
import creatures from './creatures.js'
import effects from './effects.js'
import displaySprites from './displaySprites.js'
import sounds from './sounds.js'
import uiSpriteOverrides from './uiSpriteOverrides.js'

const HANDLERS = new Map()

function register(handler) {
  if (!handler || !handler.contentType) {
    throw new Error('handler missing contentType')
  }
  if (HANDLERS.has(handler.contentType)) {
    throw new Error(`duplicate registration for content_type ${handler.contentType}`)
  }
  HANDLERS.set(handler.contentType, handler)
}

register(abilityIcons)
register(nationBadges)
register(legendMarkIcons)
register(itemIcons)
register(creatures)
register(effects)
register(displaySprites)
register(sounds)
register(uiSpriteOverrides)

/** Lookup the registered handler for a given manifest content_type. */
export function getHandler(contentType) {
  return HANDLERS.get(contentType) ?? null
}

/** Iterate all registered handlers (implemented + planned). */
export function listHandlers() {
  return Array.from(HANDLERS.values())
}

/** Iterate handlers with status === 'implemented'. */
export function listImplementedHandlers() {
  return Array.from(HANDLERS.values()).filter((h) => h.status === 'implemented')
}
