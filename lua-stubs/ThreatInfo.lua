-- Generated from Objects/ThreatInfo.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class ThreatInfo
---@field Owner Guid
---@field OwnerObject Creature
---@field HighestThreat Creature
---@field HighestThreatEntry ThreatEntry
---@field Count number
---@field LastCaster Creature
local ThreatInfo = {}


---@param priority CreatureTargetPriority
---@return Creature[]
function ThreatInfo.GetTargets(priority) end

---@param threat Creature
---@param amount number
function ThreatInfo.IncreaseThreat(threat, amount) end

---@param threat Creature
---@param amount number
function ThreatInfo.DecreaseThreat(threat, amount) end

---@param threat Creature
function ThreatInfo.ClearThreat(threat) end

---@param newThreat Creature
---@param amount? number
function ThreatInfo.AddNewThreat(newThreat, amount) end

---@param threat Creature
function ThreatInfo.RemoveThreat(threat) end

function ThreatInfo.RemoveAllThreats() end

---@param threat Creature
---@return boolean
function ThreatInfo.ContainsThreat(threat) end

---@param users User[]
---@return boolean
function ThreatInfo.ContainsAny(users) end

---@param threat Creature
function ThreatInfo.OnRangeExit(threat) end

---@param threat Creature
function ThreatInfo.OnRangeEnter(threat) end

---@param threat Creature
function ThreatInfo.ForceThreatChange(threat) end

---@param threat Creature
---@param amount? number
function ThreatInfo.OnCast(threat, amount) end

---@param threat Creature
---@param amount number
function ThreatInfo.OnNearbyHeal(threat, amount) end

return ThreatInfo
