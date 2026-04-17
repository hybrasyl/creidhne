-- Generated from Subsystems/Scripting/HybrasylUtility.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---A variety of utility functions for scripts that are statically accessible from a global `utility` object.
---@class HybrasylUtility
---@field HybrasylUtility class
local HybrasylUtility = {}


---Get the current Terran hour for the local (timezone of the server) time.
---@return number
function HybrasylUtility.GetCurrentHour() end

---Get the current Terran day for the local (timezone of the server) time.
---@return number
function HybrasylUtility.GetCurrentDay() end

---Get current Unix time.
---@return number
function HybrasylUtility.GetUnixTime() end

---Calculate the number of hours (float) between two Unix timestamps t1 and t2.
---@param t1 number First timestamp
---@param t2 number Second timestamp
---@return number
function HybrasylUtility.HoursBetweenUnixTimes(t1, t2) end

---Calculate the number of hours (float) between two Unix timestamps represented as strings.
---@param t1 string
---@param t2 string
---@return number
function HybrasylUtility.HoursBetweenUnixTimes(t1, t2) end

---Calculate the number of minutes (float) between two Unix timestamps t1 and t2.
---@param t1 number First timestamp
---@param t2 number Second timestamp
---@return number
function HybrasylUtility.MinutesBetweenUnixTimes(t1, t2) end

---@param minVal number
---@param maxVal number
---@return number
function HybrasylUtility.Rand(minVal, maxVal) end

---@param maxVal number
---@return number
function HybrasylUtility.Rand(maxVal) end

---Calculate the number of hours (float) between two Unix timestamps represented as strings.
---@param t1 string First timestamp
---@param t2 string Second timestamp
---@return number
function HybrasylUtility.MinutesBetweenUnixTimes(t1, t2) end

---Send an in-game mail to a player.
---@param to string The recipient (must be a player)
---@param from string The sender (can be any string)
---@param subject string The subject of the message
---@param body string Message body (up to 64k characters)
---@return boolean
function HybrasylUtility.SendMail(to, from, subject, body) end

---Send an in-game parcel to a player. The user will receive a message telling them to go to their town's post office to pick up the parcel. If they are online, they will also receive a system message.
---@param to string The recipient (must be a player)
---@param from string The sender (can be any string)
---@param itemName string The item to be sent
---@param quantity? number Quantity to be sent (for stackable items)
---@return boolean
function HybrasylUtility.SendParcel(to, from, itemName, quantity) end

---@param id string
---@param title string
---@param summary string
---@param result string
---@param reward string
---@param prerequisite string
---@param circle number
---@return boolean
function HybrasylUtility.RegisterQuest(id, title, summary, result, reward, prerequisite, circle) end

---@param mapId number
---@param x number
---@param y number
---@param creatureName string
---@param behaviorSet string
---@param level number
---@param aggro boolean
function HybrasylUtility.CreateMonster(mapId, x, y, creatureName, behaviorSet, level, aggro) end

---Convert a string direction to a (intended for usage from Lua)
---@param direction string The string to convert
---@return Direction The appropriate or North, if it could not be converted
function HybrasylUtility.DirectionFromString(direction) end

---Given a , return its opposite direction
---@param direction Direction The direction to convert
---@return Direction The appropriate or North, if it could not be converted
function HybrasylUtility.OppositeDirection(direction) end

---Given a string direction, return its opposite .
---@param direction string The direction to convert
---@return Direction The appropriate or North, if it could not be converted
function HybrasylUtility.OppositeDirection(direction) end

return HybrasylUtility
