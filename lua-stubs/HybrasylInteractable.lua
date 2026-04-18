-- Generated from Subsystems/Scripting/HybrasylInteractable.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---A scriptable class that can be used to evaluate OnLoad requests to create dialog sequences, which can then be evaluated later (used specifically for items)
---@class HybrasylInteractable
local HybrasylInteractable = {}


---@param wrapped HybrasylDialogSequence
function HybrasylInteractable.RegisterDialogSequence(wrapped) end

---@param sprite number
function HybrasylInteractable.SetItemSprite(sprite) end

---@param sprite number
function HybrasylInteractable.SetCreatureSprite(sprite) end

return HybrasylInteractable
