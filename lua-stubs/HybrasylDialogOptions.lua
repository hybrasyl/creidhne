-- Generated from Subsystems/Scripting/HybrasylDialogOptions.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---A collection of dialog options that can be used by an options dialog (a dialog that displays a list of options for a player to select).
---@class HybrasylDialogOptions
---@field HybrasylDialogOptions class
local HybrasylDialogOptions = {}


---Add a dialog option which will fire a function when selected by a player.
---@param option string The option text
---@param luaExpr? string The lua expression to be evaluated when the option is selected by a player
---@param checkExpr? string A lua expression returning a boolean which controls whether this option is displayed to the player
function HybrasylDialogOptions.AddOption(option, luaExpr, checkExpr) end

---Add a dialog option which will fire a JumpDialog when selected by a player.
---@param option string The option text
---@param nextDialog HybrasylDialog The JumpDialog that will be used by this option
---@param checkExpr? string A lua expression returning a boolean which controls whether this option is displayed to the player
function HybrasylDialogOptions.AddOption(option, nextDialog, checkExpr) end

---Add a dialog option that will start a new sequence when selected by a player.
---@param option string The option text
---@param sequence HybrasylDialogSequence The DialogSequence that wil be started when the option is selected by a player
---@param checkExpr? string A lua expression returning a boolean which controls whether this option is displayed to the player
function HybrasylDialogOptions.AddOption(option, sequence, checkExpr) end

return HybrasylDialogOptions
