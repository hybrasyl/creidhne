-- Generated from Subsystems/Scripting/ScriptLogger.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---A logging class that can be used by scripts natively in Lua.
---@class ScriptLogger
---@field ScriptName string
local ScriptLogger = {}


---@param message string
function ScriptLogger.Info(message) end

---@param message string
function ScriptLogger.Error(message) end

return ScriptLogger
