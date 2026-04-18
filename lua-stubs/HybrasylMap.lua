-- Generated from Subsystems/Scripting/HybrasylMap.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylMap
---@field HybrasylMap class
---@field Id number
---@field Name string
local HybrasylMap = {}


---@param name string
---@param x? number
---@param y? number
---@return boolean
function HybrasylMap.CreateItem(name, x, y) end

---@param obj HybrasylWorldObject
---@param x number
---@param y number
function HybrasylMap.DropItem(obj, x, y) end

---Check to see if a creature (player or monster) is present at the given coordinates.
---@param x number X coordinate on map
---@param y number Y coordinate on map
---@return boolean
function HybrasylMap.IsCreatureAt(x, y) end

---Get a player at the given coordinates. Returns null if no player exists.
---@param x number X coordinate on map
---@param y number Y coordinate on map
---@return HybrasylUser
function HybrasylMap.GetPlayerAt(x, y) end

---Get a monster at the given coordinates. Return null if no monster exists.
---@param x number X coordinate on map
---@param y number Y coordinate on map
---@return HybrasylMonster
function HybrasylMap.GetMonsterAt(x, y) end

return HybrasylMap
