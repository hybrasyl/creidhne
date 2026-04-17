-- Generated from Objects/ElementalResistance.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class ElementalModifiers
---@field ElementalModifiers class
---@field Empty boolean
---@field NoAugments boolean
---@field NoResistances boolean
local ElementalModifiers = {}


---@param element ElementType
---@return number
function ElementalModifiers.GetResistance(element) end

---@param element ElementType
---@param mod number
function ElementalModifiers.ModifyResistance(element, mod) end

---@param element ElementType
---@return number
function ElementalModifiers.GetAugment(element) end

---@param element ElementType
---@param mod number
function ElementalModifiers.ModifyAugment(element, mod) end

---@param elementalModifiers ElementalModifier[]
function ElementalModifiers.Apply(elementalModifiers) end

---@param elementalModifiers ElementalModifier[]
function ElementalModifiers.Remove(elementalModifiers) end

return ElementalModifiers
