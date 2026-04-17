-- Generated from Subsystems/Scripting/HybrasylMonster.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylMonster : HybrasylWorldObject
---@field Direction Direction
---@field ThreatInfo ThreatInfo
---@field Target WorldObject
---@field AbsoluteImmortal boolean
---@field PhysicalImmortal boolean
---@field MagicalImmortal boolean
---@field FirstHitter WorldObject
---@field LastHitter WorldObject
---@field LastHitTime string
---Access the StatInfo of the specified user directly (all stats).
---@field Stats StatInfo
local HybrasylMonster = {}


---Forcibly change the active target of the monster to the specified user.
---@param target HybrasylUser representing the target user.
function HybrasylMonster.ChangeActiveTarget(target) end

---Forcibly set a monster to be hostile.
function HybrasylMonster.SetHostile() end

---Forcibly set a monster to be neutral (won't attack until attacked).
function HybrasylMonster.SetNeutral() end

---Deal damage to the current player.
---@param damage number Integer amount of damage to deal.
---@param element? ElementType Element of the damage (e.g. fire, air)
---@param damageType? DamageType Type of damage (direct, magical, etc)
function HybrasylMonster.Damage(damage, element, damageType) end

---@param displaySprite number
function HybrasylMonster.SetCreatureDisplaySprite(displaySprite) end

---Directly damage the monster for the specified amount.
---@param damage number Amount of damage
function HybrasylMonster.DirectDamage(damage) end

---Directly heal the monster for the specified amount.
---@param heal number Amount of damage
function HybrasylMonster.DirectHeal(heal) end

---@return number
function HybrasylMonster.GetCreatureDisplaySprite() end

---@return string
function HybrasylMonster.GetGMMonsterInfo() end

---Apply a given status to a player.
---@param statusName string The name of the status
---@param duration? number The duration of the status, if zero, use default
---@param tick? number How often the tick should fire on the status (eg OnTick), if zero, use default
---@param intensity? number The intensity of the status (damage modifier), defaults to 1.0
---@return boolean boolean indicating whether or not the status was applied
function HybrasylMonster.ApplyStatus(statusName, duration, tick, intensity) end

return HybrasylMonster
