-- Generated from Subsystems/Dialogs/AsyncDialogSession.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---An AsyncDialogSession is a dialog sequence that is showed to a player based on asynchronous input from another script, player, or event (such as a mentoring request).
---@class AsyncDialogSession
---@field Source IVisible
---@field Target User
---@field Origin IInteractable
---@field Guid Guid
---@field RequireLocal boolean
---@field StartSequence string
---@field Complete boolean
---@field Ready boolean
---@field Name string
---@field DisplayName string
---@field Id number
---@field Script Script
---@field AllowDead boolean
---@field Sprite number
---@field DialogSequences DialogSequence[]
---@field DialogSprite number
local AsyncDialogSession = {}


---@param guid Guid
---@return boolean
function AsyncDialogSession.IsParticipant(guid) end

---@return boolean
function AsyncDialogSession.Start() end

function AsyncDialogSession.CloseSource() end

function AsyncDialogSession.CloseTarget() end

function AsyncDialogSession.Close() end

---@param name string
function AsyncDialogSession.Close(name) end

---@param guid Guid
function AsyncDialogSession.Close(guid) end

---@return boolean
function AsyncDialogSession.CheckRequest() end

---@return boolean
function AsyncDialogSession.ShowTo() end

return AsyncDialogSession
