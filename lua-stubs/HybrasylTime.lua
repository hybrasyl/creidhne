-- Generated from Subsystems/Time.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---A class for representing time in Hybrasyl. There are generally two types of time - "current" time, e.g. time since server start, and "historical" time - anything before that. We use DateTime to represent both, meaning a Hybrasyl age has an upper limit of 16,144 years in the past (that is to say, the start of the age cannot be before DateTime.MinValue). In the absence of age definitions in config.xml we use a default age "Hybrasyl", whose first year (Hybrasyl 1) is equivalent to the server start time.
---@class HybrasylTime
---@field HybrasylTime class
---@field TerranDateTime DateTime
---@field AgeName string
---@field Age HybrasylAge
---@field HybrasylTicks number
---@field TerranTicks number
---@field YearTicks number
---@field MoonTicks number
---@field SunTicks number
---@field HourTicks number
---@field MinuteTicks number
---@field Year number
---@field Moon number
---@field Sun number
---@field Hour number
---@field Minute number
---@field Season string
---@field DefaultAgeName string
---@field DefaultYear number
---Default age is "Hybrasyl", year 1 is either the recorded ServerStart time in config.xml, or, if we can't find that, the current running server's start time
---@field DefaultAge HybrasylAge
---@field CurrentAgeName string
---@field CurrentSeason string
---@field CurrentAge HybrasylAge
---@field CurrentYear number
---@field Now HybrasylTime
local HybrasylTime = {}


---@param datetime DateTime
---@return HybrasylAge
function HybrasylTime.GetAgeFromTerranDate(datetime) end

---@param age string
---@return boolean
function HybrasylTime.ValidAge(age) end

---@return string
function HybrasylTime.ToString() end

---@return HybrasylAge[]
function HybrasylTime.Ages() end

---@param age string
---@return number
function HybrasylTime.FirstYearInAge(age) end

---@param year? number
---@param moon? number
---@param sun? number
---@param hour? number
---@param minute? number
function HybrasylTime.SubtractInGameTime(year, moon, sun, hour, minute) end

---@param year? number
---@param moon? number
---@param sun? number
---@param hour? number
---@param minute? number
function HybrasylTime.AddInGameTime(year, moon, sun, hour, minute) end

---@param hybrasyltime HybrasylTime
---@return DateTime
function HybrasylTime.ConvertToTerran(hybrasyltime) end

---@param datetime DateTime
---@return HybrasylTime
function HybrasylTime.ConvertToHybrasyl(datetime) end

---@param hybrasyldate string
---@return HybrasylTime
function HybrasylTime.FromString(hybrasyldate) end

---@param datetimestring string
---@return HybrasylTime
function HybrasylTime.FromDateTimestring(datetimestring) end

return HybrasylTime
