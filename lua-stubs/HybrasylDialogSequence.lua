-- Generated from Subsystems/Scripting/HybrasylDialogSequence.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylDialogSequence
---@field HybrasylDialogSequence class
local HybrasylDialogSequence = {}


---Add a dialog to this sequence (at the end of the sequence).
---@param scriptDialog HybrasylDialog A dialog that will be added to the end of the sequence.
function HybrasylDialogSequence.AddDialog(scriptDialog) end

---Add a display callback to the dialog sequence that will be evaluated before it is displayed.
---@param check string A lua scripting expression to be evaluated
function HybrasylDialogSequence.AddDisplayCallback(check) end

---Add a menu check to the given dialog sequence. If this is a pursuit, the (boolean) expression will be evaluated before the dialog is added to the list of pursuits (NPC main menu).
---@param check string The Lua expression to be evaluated as a check, which should return true or false.
function HybrasylDialogSequence.AddMenuCheckExpression(check) end

---Set an NPC / creature display sprite for this sequence (will be used for all of its contained dialogs). This is the sprite that is displayed on the left hand side when a user views a dialog.
---@param displaySprite number Integer representing the creature display sprite in the client datfiles.
function HybrasylDialogSequence.SetNpcDisplaySprite(displaySprite) end

---Set an item display sprite for this sequence (will be used for all of its contained dialogs). This is the sprite that is displayed on the left hand side when a user views a dialog.
---@param displaySprite number Integer representing the item display sprite in the client datfiles.
function HybrasylDialogSequence.SetItemDisplaySprite(displaySprite) end

---Set the display name for this sequence, which is the text that will be displayed if this sequence is listed from the main menu (e.g. is a pursuit).
---@param displayName string
function HybrasylDialogSequence.SetDisplayName(displayName) end

---Associate a named script with this dialog sequence. This can be used to override processing or provide more detailed custom scripting.
---@param scriptName string The name of a script known to Hybrasyl.
function HybrasylDialogSequence.AssociateWithScript(scriptName) end

return HybrasylDialogSequence
