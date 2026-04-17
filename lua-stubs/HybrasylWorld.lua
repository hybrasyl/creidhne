-- Generated from Subsystems/Scripting/HybrasylWorld.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---The world, as represented in Lua.
---@class HybrasylWorld
---@field HybrasylWorld class
---Return the current in game year.
---@field CurrentInGameYear number
---Return the current in game age (e.g. Hybrasyl, or Danaan).
---@field CurrentInGameAge string
---@field CurrentInGameSeason string
local HybrasylWorld = {}


---Write a message to the game (server) informational log.
---@param message string The message to be written
function HybrasylWorld.WriteLog(message) end

---Return the current in-game time.
---@return HybrasylTime
function HybrasylWorld.CurrentTime() end

---Get a user object for the specified user (player) name.
---@param username string The user to be returned
---@return HybrasylUser HybrasylUser object for the given user, or nil, if the player is not logged in.
function HybrasylWorld.GetUser(username) end

---Create a new dialog options container.
---@return HybrasylDialogOptions A new DialogOptions container.
function HybrasylWorld.NewDialogOptions() end

---Create a new dialog sequence.
---@param sequenceName string The name of the new sequence.
---@param ... any[] An arbitrary collection of dialogs that will be made part of this sequence.
---@return HybrasylDialogSequence The constructed dialog sequence
function HybrasylWorld.NewDialogSequence(sequenceName, ...) end

---Create a new "simple" (text-only) dialog.
---@param displayText string The text that the dialog will display to the player.
---@param callback? string A lua callback that can be associated with the dialog, and will be fired when the dialog is shown to a player.
---@return HybrasylDialog The constructed dialog
function HybrasylWorld.NewDialog(displayText, callback) end

---Create a new dialog sequence consisting of a bunch of simple text dialogs.
---@param sequenceName string The name of the constructed sequence.
---@param ... string[] A string array of dialog lines that will be used to construct each dialog in the sequence.
---@return HybrasylDialogSequence The constructed dialog seqeunce
function HybrasylWorld.NewSimpleDialogSequence(sequenceName, ...) end

---Create a new dialog sequence consisting of a simple dialog and a jump to a new sequence. Useful for a lot of dialogs where you need to display one dialog and go back to the main menu.
---@param simpleDialog string Text for the simple dialog.
---@param jumpTarget string The new sequence to start after the user hits next on the simple dialog.
---@param callback? string An optional Lua callback expression that will be attached to the simple dialog.
---@param name? string An optional name to give the dialog sequence.
---@return HybrasylDialogSequence The constructed dialog sequence
function HybrasylWorld.NewTextAndJumpDialog(simpleDialog, jumpTarget, callback, name) end

---Another convenience function to generate an "end" sequence where the user must hit close (e.g. a dialog end). This is useful to make a jumpable end to a previous dialog option.
---@param simpleDialog string The text of the simple dialog.
---@param callback? string An optional Lua callback expression that will be attached to the simple dialog.
---@param name? string An optional name to give the dialog sequence.
---@return HybrasylDialogSequence The constructed dialog sequence
function HybrasylWorld.NewEndSequence(simpleDialog, callback, name) end

---Create a new text dialog (a dialog that asks a player a question; the player can type in a response).
---@param displayText string The text to be displayed in the dialog
---@param topCaption string The top caption of the text box input
---@param bottomCaption string The bottom caption of the text box input
---@param inputLength? number The maximum length (up to 254 characters) of the text that can be typed into the dialog by the player
---@param callback? string The callback function or lua expression that will fire when this dialog is shown to a player.
---@param handler? string The function or lua expression that will handle the response once the player hits enter / hits next.
---@return HybrasylDialog The constructed dialog
function HybrasylWorld.NewTextDialog(displayText, topCaption, bottomCaption, inputLength, callback, handler) end

---Create a new options dialog (a dialog that displays clickable options to the player).
---@param displayText string The text to be displayed in the dialog
---@param dialogOptions HybrasylDialogOptions A collection of dialog options (eg HybrasylDialogOptions) associated with this dialog
---@param callback? string A callback function or expression that will fire when this dialog is shown to a player
---@param handler? string A callback function or expression that will handle the response once a player selects (clicks) an option
---@return HybrasylDialog The constructed dialog
function HybrasylWorld.NewOptionsDialog(displayText, dialogOptions, callback, handler) end

---Create a function dialog, which is an "invisible" dialog that will execute a Lua expression when shown to the player. The dialog function will be run, and then the next dialog in the sequence will be shown to the player.
---@param luaExpr string The lua expression to run when the FunctionDialog is evaluated
---@return HybrasylDialog The constructed dialog
function HybrasylWorld.NewFunctionDialog(luaExpr) end

---Create a jump dialog, which is an "invisible" dialog that is used to start a new sequence from a subdialog. Can be used to jump between different NPC dialogue branches.
---@param targetSequence string The name of the sequence that will start when this JumpDialog is "shown" to the player.
---@param callbackExpression? string A lua expression that will run when this dialog is shown to the player.
---@return HybrasylDialog The constructed dialog
function HybrasylWorld.NewJumpDialog(targetSequence, callbackExpression) end

---Register a dialog sequence as a "global" sequence, meaning any object in the game can reference and use it.
---@param globalSequence HybrasylDialogSequence The dialog sequence to be registered as a global seqeunce.
function HybrasylWorld.RegisterGlobalSequence(globalSequence) end

---@param mapId number
---@param x number
---@param y number
---@param name string
---@param behaviorSet string
---@param level number
---@param displayName? string
function HybrasylWorld.SpawnMonster(mapId, x, y, name, behaviorSet, level, displayName) end

return HybrasylWorld
