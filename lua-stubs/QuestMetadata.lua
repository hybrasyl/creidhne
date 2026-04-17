-- Generated from Internals/Metafiles/QuestMetadata.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class QuestMetadata
---@field QuestMetadata class
---@field AllowedClasses SortedSet<Class>
---@field Id string
---@field Prerequisite string
---@field Result string
---@field Reward string
---@field Summary string
---@field Title string
---@field Classes string
local QuestMetadata = {}


---@param c Class
function QuestMetadata.AddClass(c) end

return QuestMetadata
