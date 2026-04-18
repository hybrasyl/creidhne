-- Generated from Objects/CombatEvents.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class DamageEvent : StatChangeEvent
---@field Flags DamageFlags
---@field Type DamageType
---@field EventType CombatLogEventType
---@field Element ElementType
---@field ElementalInteraction number
---@field ElementalResisted number
---@field ElementalAugmented number
---@field MagicResisted number
---@field ArmorReduction number
---@field Crit boolean
---@field MagicCrit boolean
---@field BonusDmg number
---@field ModifierDmg number
---@field Applied boolean
---@field Shielded number
local DamageEvent = {}


---@return string
function DamageEvent.ToString() end

return DamageEvent
