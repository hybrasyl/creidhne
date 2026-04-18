-- Generated from Subsystems/Scripting/HybrasylReactor.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylReactor : HybrasylWorldObject
---@field Origin HybrasylUser
---@field Blocking boolean
---@field Uses number
---@field Expired boolean
---@field Expiration number
local HybrasylReactor = {}


---Make a reactor visible to a player if they have a specified cookie.
---@param cookieName string Name of the cookie to add to the list.
---@param remove? boolean If true, remove the cookie from the list.
function HybrasylReactor.VisibleToCookie(cookieName, remove) end

---Make a reactor invisible to a player if they have a specified cookie.
---@param cookieName string Name of the cookie to add to the list.
---@param remove? boolean If true, remove the cookie from the list.
function HybrasylReactor.InvisibleToCookie(cookieName, remove) end

return HybrasylReactor
