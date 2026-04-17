-- Generated from Objects/CombatEvents.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class StatusEvent : CombatEvent
---@field Applied boolean
---@field Success boolean
---@field StatusName string
---@field RemoverName string
---@field RemovalRoll number
---@field RequiredRoll number
---@field EventType CombatLogEventType
local StatusEvent = {}


---@return string
function StatusEvent.ToString() end

return StatusEvent
