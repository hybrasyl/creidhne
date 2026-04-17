-- Generated from Subsystems/Scripting/HybrasylDialog.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylDialog
---@field HybrasylDialog class
local HybrasylDialog = {}


---Set the display sprite for this specific dialog to an NPC / creature sprite. This is the sprite that is displayed on the left hand side when a user views a dialog.
---@param displaySprite number int representing the sprite in the datfiles
function HybrasylDialog.SetNpcDisplaySprite(displaySprite) end

---Set the display sprite for this specific dialog to an item sprite. This is the sprite that is displayed on the left hand side when a user views a dialog.
---@param displaySprite number int representing the item sprite in the datfiles
function HybrasylDialog.SetItemDisplaySprite(displaySprite) end

---Assoiciate this particular dialog with a sequence.
---@param sequence DialogSequence
function HybrasylDialog.AssociateDialogWithSequence(sequence) end

---Attach a callback expression to this dialog, which will be invoked when the dialog is displayed.
---@param luaExpr string A Lua expression to be evaluated.
function HybrasylDialog.AttachCallback(luaExpr) end

return HybrasylDialog
