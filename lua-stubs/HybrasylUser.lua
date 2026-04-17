-- Generated from Subsystems/Scripting/HybrasylUser.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylUser : HybrasylWorldObject
---@field Map HybrasylMap
---@field Guid string
---@field Direction Direction
---The item in the first inventory slot of the player.
---@field FirstInventorySlot HybrasylItemObject
---@field Class Class
---@field MapName string
---The user's previous class, if a subpath.
---@field PreviousClass Class
---@field IsPlayer boolean
---@field IsPrivileged boolean
---The gender of the player. For Darkages purpose, this will evaluate to Male or Female.
---@field Gender Gender
---The current level of the user. Client supports up to level 255; Hybrasyl has the same level cap as usda, 99.
---@field Level number
---Amount of gold the user currently has.
---@field Gold number
---Access the StatInfo of the specified user directly (all stats).
---@field Stats StatInfo
---Whether the user is alive or not.
---@field Alive boolean
---@field WeaponSmallDamage number
local HybrasylUser = {}


---Give the specified amount of gold to the user.
---@param gold number Amount of gold to give.
---@return boolean
function HybrasylUser.AddGold(gold) end

---Take the specified amount of gold from the user.
---@param gold number Amount of gold to take.
---@return boolean
function HybrasylUser.RemoveGold(gold) end

---Removes a skill from the user's skillbook
---@param name string Skill to be removed
---@return boolean boolean indicating success
function HybrasylUser.RemoveSkill(name) end

---Removes a spell from the user's spellbook
---@param name string Spell to be removed
---@return boolean boolean indicating success
function HybrasylUser.RemoveSpell(name) end

---@return string
function HybrasylUser.GetNation() end

---@param nationName string
---@return boolean
function HybrasylUser.SetNation(nationName) end

---Get a list of objects in the viewport of the player. This represents all visible objects (items, players, creatures) contained in the client's viewport (the drawable map area).
---@return HybrasylWorldObject[] A list of objects in the player's viewport.
function HybrasylUser.GetViewportObjects() end

---Get a list of players in the viewport of the player. This represents only players contained in the client's viewport (the drawable map area).
---@return HybrasylUser[] A list of objects in the player's viewport.
function HybrasylUser.GetViewportPlayers() end

---Resurrect a user. They respawn in their home map with 1HP/1MP and with scars, if configured in the death handler.
function HybrasylUser.Resurrect() end

---Get the player, if any, that the current player is facing ("looking at").
---@return HybrasylUser object for the player facing this player, or nil, if the player isn't directly facing another player.
function HybrasylUser.GetFacingUser() end

---Get the objects a player is facing (for instance, items on the ground in front of the player)
---@param distance? number Maximum distance to consider in front of the user.
---@return HybrasylWorldObject[] A list of objects facing the player.
function HybrasylUser.GetFacingObjects(distance) end

---Get the monster that the player is facing.
---@return HybrasylMonster A object.
function HybrasylUser.GetFacingMonster() end

---Get a list of monsters facing the user.
---@param distance? number The maximum distance to consider from the user.
---@return HybrasylMonster[] A list of objects facing the user.
function HybrasylUser.GetFacingMonsters(distance) end

---Get a list of players facing the user.
---@param distance? number The maximum distance to consider from the user.
---@return HybrasylUser[] A list of objects facing the user.
function HybrasylUser.GetFacingUsers(distance) end

---Return a list of monsters in a specified direction.
---@param direction Direction The to examine.
---@param radius? number The number of tiles to examine in the given direction.
---@return HybrasylMonster[]
function HybrasylUser.GetMonstersInDirection(direction, radius) end

---Return a list of players in a specified direction.
---@param direction Direction The to examine.
---@param radius? number The number of tiles to examine in the given direction.
---@return HybrasylUser[] List of .
function HybrasylUser.GetUsersInDirection(direction, radius) end

---Get the coordinates of a tile in a specific direction and number of tiles away from current location.
---@param direction Direction The to use.
---@param tiles? number The number of tiles away from the current location in the specified direction.
---@return Coordinate A representing the X,Y of the calculated tile.
function HybrasylUser.GetTileInDirection(direction, tiles) end

---Set the users facing direction.
---@param direction string A cardinal direction (north, south, east, west).
function HybrasylUser.ChangeDirection(direction) end

---End coma state (e.g. beothaich was used)
function HybrasylUser.EndComa() end

---Teleport a user to their "home" (ordinary spawnpoint), or a map of last resort.
function HybrasylUser.SendHome() end

---Get a legend mark from the current player's legend (a list of player achievements and accomplishments which is visible by anyone in the world), given a legend prefix. All legend marks have invisible prefixes (keys) for editing / storage capabilities.
---@param prefix string The prefix we want to retrieve (legend key)
---@return any
function HybrasylUser.GetLegendMark(prefix) end

---Check to see if a player has a legend mark with the specified prefix in their legend.
---@param prefix string Prefix of the mark to check
---@return boolean boolean
function HybrasylUser.HasLegendMark(prefix) end

---Check to see if the player has an item equipped with the specified name.
---@param item string
---@return boolean boolean
function HybrasylUser.HasEquipment(item) end

---Change the class of a player to a new class. The player's class will immediately change and they will receive a legend mark that reads "newClass by oath of oathGiver, XXX".
---@param newClass Class The player's new class./param> The name of the NPC or player who gave oath for this class change.
---@param oathGiver string
function HybrasylUser.ChangeClass(newClass, oathGiver) end

---Generate a list of reactors in the current user's viewport.
---@return HybrasylReactor[] List of objects in the player's viewport.
function HybrasylUser.GetReactorsInViewport() end

---Check to see whether the user has killed a named monster, optionally in the last n minutes.
---@param name string The name of the monster to check
---@param since number Specify that the kills should have occurred after the given Unix timestamp.
---@param quantity? number Specify that a certain number of kills should have occurred.
---@return boolean Boolean indicating whether the specified requirements have been met.
function HybrasylUser.HasKilledSince(name, since, quantity) end

---Return the number of named monsters the player has killed since a specific timestamp.
---@param name string The name of the monster to check
---@param since? number Specify that the kills should have occurred after the given Unix timestamp.
---@return number Number of named monsters killed.
function HybrasylUser.NumberKilled(name, since) end

---Check to see whether the user has killed a quantity of a named monster, optionally in the last n minutes.
---@param name string The name of the monster to check
---@param quantity? number Specify that a certain number of kills should have occurred. Default is 1.
---@param minutes? number The number of minutes to limit the check. 0 is default and means no limit.
---@return boolean Boolean indicating whether or not the specified requirements were met.
function HybrasylUser.HasKilled(name, quantity, minutes) end

---Return the player's entire legend.
---@return Legend A object representing the player's legend.
function HybrasylUser.GetLegend() end

---Add a legend mark with the specified icon, color, text, and prefix to a player's legend, which will default to being issued now (current in-game time).
---@param icon LegendIcon A enum indicating the icon to be used for the mark (heart, sword, etc)
---@param color LegendColor A indicating the color the mark will be rendered in (blue, yellow, orange, etc)
---@param text string The actual text of the legend mark.
---@param prefix? string An invisible key (stored in the beginning of the mark) that can be used to refer to the mark later.
---@param isPublic? boolean Whether or not this legend mark can be seen by other players. By convention, private marks are prefixed with " - ".
---@param quantity? number Quantity of the legend mark. For instance "Mentored Dude (2)". Also by convention, quantity is expressed in parenthesis at the end of the mark.
---@param displaySeason? boolean Whether or not to display the season of a mark (e.g. Fall, Summer)
---@param displayTimestamp? boolean Whether or not to display the in-game time of a mark (e.g. Hybrasyl 5)
---@return boolean Boolean indicating success or failure.
function HybrasylUser.AddLegendMark(icon, color, text, prefix, isPublic, quantity, displaySeason, displayTimestamp) end

---Add a legend mark with the specified icon, color, text, timestamp and prefix to a player's legend.
---@param icon LegendIcon A enum indicating the icon to be used for the mark (heart, sword, etc)
---@param color LegendColor A indicating the color the mark will be rendered in (blue, yellow, orange, etc)
---@param text string The actual text of the legend mark.
---@param timestamp HybrasylTime The in-game time the legend was awarded.
---@param prefix string An invisible key (stored in the beginning of the mark) that can be used to refer to the mark later.
---@return boolean Boolean indicating success or failure.
function HybrasylUser.AddLegendMark(icon, color, text, timestamp, prefix) end

---Add a legend mark to a player's legend.
---@param icon LegendIcon A enum indicating the icon to be used for the mark (heart, sword, etc)
---@param color LegendColor A indicating the color the mark will be rendered in (blue, yellow, orange, etc)
---@param text string The actual text of the legend mark.
---@param timestamp DateTime The Terran time the legend was awarded.
---@param prefix? string An invisible key (stored in the beginning of the mark) that can be used to refer to the mark later.
---@param isPublic? boolean Whether or not this legend mark can be seen by other players. By convention, private marks are prefixed with " - ".
---@param quantity? number Quantity of the legend mark. For instance "Mentored Dude (2)". Also by convention, quantity is expressed in parenthesis at the end of the mark.
---@param displaySeason? boolean Whether or not to display the season of a mark (e.g. Fall, Summer)
---@param displayTimestamp? boolean Whether or not to display the in-game time of a mark (e.g. Hybrasyl 5)
---@return boolean Boolean indicating success or failure.
function HybrasylUser.AddLegendMark(icon, color, text, timestamp, prefix, isPublic, quantity, displaySeason, displayTimestamp) end

---Remove the given legend mark from a player's legend.
---@param prefix string The prefix key of the legend mark to be removed.
---@return boolean Boolean indicating success or failure.
function HybrasylUser.RemoveLegendMark(prefix) end

---Modify a previously created legend mark. You can set a new quantity, or set an existing mark as public or private.
---@param prefix string Prefix key of the legend mark to be modified.
---@param quantity number A quantity to be assigned to the mark.
---@param isPublic boolean Whether or not the mark should be public or not.
---@return boolean Boolean indicating whether the mark for modification was found or not
function HybrasylUser.ModifyLegendMark(prefix, quantity, isPublic) end

---Increment a legend mark with a quantity.
---@param prefix string The legend mark prefix to modify.
---@param preserveDate? boolean Whether or not to preserve the date. If true, the date of the mark is not updated.
---@return boolean Boolean indicating whether the mark existed / was updated
function HybrasylUser.IncrementLegendMark(prefix, preserveDate) end

---Decrement a legend mark with a quantity.
---@param prefix string The legend mark prefix to modify.
---@param preserveDate? boolean Whether or not to preserve the date. If true, the date of the mark is not updated.
---@return boolean Boolean indicating whether the mark existed / was updated
function HybrasylUser.DecrementLegendMark(prefix, preserveDate) end

---Set a session cookie. A cookie is a key-value pair with a dynamic value (of any type) associated to a given name (a string key). NPCs and other scripting functionality can use this to store independent state to track quest progress / etc. Session cookies are deleted when a player is logged out.
---@param cookieName string Name of the cookie
---@param value any Dynamic (any type) value to be stored with the given name.
function HybrasylUser.SetSessionCookie(cookieName, value) end

---Set a session cookie in a specified namespace. A cookie is a key-value pair with a dynamic value (of any type) associated to a given name (a string key). NPCs and other scripting functionality can use this to store independent state to track quest progress / etc. Session cookies are deleted when a player is logged out.
---@param ns string The namespace of the cookie
---@param cookieName string Name of the cookie
---@param value any Dynamic (any type) value to be stored with the given name.
function HybrasylUser.SetSessionCookie(ns, cookieName, value) end

---@param cookieName string Name of the cookie
---@param value any Dynamic (any type) value to be stored with the given name.
function HybrasylUser.SetCookie(cookieName, value) end

---Set a cookie. A cookie is a key-value pair with a dynamic value (of any type) associated to a given name (a string key). NPCs and other scripting functionality can use this to store independent state to track quest progress / etc. Cookies set by SetCookie are permanent.
---@param ns string The namespace of the cookie
---@param cookieName string Name of the cookie
---@param value any Dynamic (any type) value to be stored with the given name.
function HybrasylUser.SetCookie(ns, cookieName, value) end

---Get the value of a session cookie, if it exists.
---@param cookieName string The name of the cookie to fetch
---@return string string representation of the cookie value
function HybrasylUser.GetSessionCookie(cookieName) end

---Get the value of a session cookie in a namespace, if it exists.
---@param ns string The namespace to consult
---@param cookieName string The name of the cookie to fetch
---@return string string representation of the cookie value
function HybrasylUser.GetSessionCookie(ns, cookieName) end

---Get the value of a cookie, if it exists.
---@param cookieName string The name of the cookie to fetch
---@return string string representation of the cookie value
function HybrasylUser.GetCookie(cookieName) end

---Get the value of a cookie, if it exists.
---@param ns string The namespace to consult
---@param cookieName string The name of the cookie to fetch
---@return string string representation of the cookie value
function HybrasylUser.GetCookie(ns, cookieName) end

---Check to see if a player has a specified cookie or not.
---@param cookieName string Cookie name to check
---@return boolean Boolean indicating whether or not the named cookie exists
function HybrasylUser.HasCookie(cookieName) end

---Check to see if a player has a specified cookie or not in the specified namespace.
---@param ns string The namespace of the cookie
---@param cookieName string Cookie name to check
---@return boolean Boolean indicating whether or not the named cookie exists
function HybrasylUser.HasCookie(ns, cookieName) end

---Check to see if a player has a specified session cookie or not.
---@param cookieName string Cookie name to check
---@return boolean Boolean indicating whether or not the named cookie exists
function HybrasylUser.HasSessionCookie(cookieName) end

---Check to see if a player has a specified session cookie or not in the specified namespace.
---@param ns string The namespace of the cookie
---@param cookieName string Cookie name to check
---@return boolean Boolean indicating whether or not the named cookie exists
function HybrasylUser.HasSessionCookie(ns, cookieName) end

---Permanently remove a cookie from a player.
---@param cookieName string The name of the cookie to be deleted.
---@return boolean
function HybrasylUser.DeleteCookie(cookieName) end

---Permanently remove a cookie from a player in the specified namespace.
---@param ns string The namespace of the cookie
---@param cookieName string The name of the cookie to be deleted.
---@return boolean
function HybrasylUser.DeleteCookie(ns, cookieName) end

---Permanently remove a session cookie from a player.
---@param cookieName string The name of the cookie to be deleted.
---@return boolean
function HybrasylUser.DeleteSessionCookie(cookieName) end

---Permanently remove a session cookie from a player in the specified namespace.
---@param ns string The namespace of the cookie
---@param cookieName string The name of the cookie to be deleted.
---@return boolean
function HybrasylUser.DeleteSessionCookie(ns, cookieName) end

---Display a motion on the user
---@param motionId number the motion to display
---@param speed? number speed of the diplayed motion
function HybrasylUser.DisplayMotion(motionId, speed) end

---Heal a player to full HP.
function HybrasylUser.HealToFull() end

---Heal a player for the specified amount of HP.
---@param heal number Integer amount of HP to be restored.
function HybrasylUser.Heal(heal) end

---Deal damage to the current player.
---@param damage number Integer amount of damage to deal.
---@param element? ElementType Element of the damage (e.g. fire, air)
---@param damageType? DamageType Type of damage (direct, magical, etc)
function HybrasylUser.Damage(damage, element, damageType) end

---Deal physical (direct) damage to the current player.
---@param damage number Integer amount of damage to deal.
---@param fatal? boolean Whether or not the damage should kill the player. If false, damage > current HP is reduced to (hp-1).
function HybrasylUser.Damage(damage, fatal) end

---Give an instance of an item to a player.
---@param obj HybrasylWorldObject HybrasylWorldObject, representing an item existing in the world, to give to the player.
---@return boolean Boolean indicating whether or not it was successful (player may have full inventory, etc)
function HybrasylUser.GiveItem(obj) end

---Check to see if a user has the specified cookie; if not, set it, give experience, and optionally, send them a system message.
---@param cookie string Name of the cookie to be set.
---@param xp? number Amount of XP to award.
---@param completionMessage? string A system message that will be sent to the user.
---@return boolean Boolean indicating whether or not the user was awarded XP.
function HybrasylUser.CompletionAward(cookie, xp, completionMessage) end

---Give a new instance of the named item to a player, optionally with a specified quantity.
---@param name string The name of the item to be created.
---@param count? number The count (stack) of the item to be created.
---@return boolean Boolean indicating whether or not it was successful (player may have full inventory, etc)
function HybrasylUser.GiveItem(name, count) end

---Check to see if a player has an item, optionally with a specified quantity.
---@param name string The name of the item to check.
---@param count? number The quantity that will be checked.
---@return boolean
function HybrasylUser.HasItem(name, count) end

---Take an item with a given name and an optional quantity from the current player's inventory.
---@param name string The name of the item to be removed.
---@param count? number The quantity to be removed.
---@param force? boolean Whether or not to force remove the item (override whether it is bound, etc)
---@return boolean Boolean indicating whether or not it the item was successfully removed from the player's inventory.
function HybrasylUser.TakeItem(name, count, force) end

---Give experience to the current player.
---@param exp number Integer amount of experience to be awarded.
function HybrasylUser.GiveExperience(exp) end

---@param scaleFactor number
---@param levelMaximum number
---@param expMinimum number
---@param expMaximum number
function HybrasylUser.GiveScaledExperience(scaleFactor, levelMaximum, expMinimum, expMaximum) end

---Take experience from the current player.
---@param exp number Integer amount of experience to be deducted.
---@return boolean Whether or not the experience was removed (if the requested amount exceeds total experience, none will be removed).
function HybrasylUser.TakeExperience(exp) end

---Add a given skill to a player's skillbook.
---@param skillname string The name of the skill to be added.
---@return boolean Boolean indicating success
function HybrasylUser.AddSkill(skillname) end

---Directly damage the user for the specified amount.
---@param damage number Amount of damage
function HybrasylUser.DirectDamage(damage) end

---Directly heal the user for the specified amount.
---@param heal number Amount of damage
function HybrasylUser.DirectHeal(heal) end

---Check to see if the specified skill exists in the user's skill book.
---@param skillname string Name of the skill to find.
---@return boolean Boolean indicating whether or not the user knows the skill.
function HybrasylUser.HasSkill(skillname) end

---Add a given spell to a player's spellbook.
---@param spellname string The name of the spell to be added.
---@return boolean Boolean indicating success
function HybrasylUser.AddSpell(spellname) end

---Check to see if the specified spell exists in the user's spell book.
---@param spellname string
---@return boolean Boolean indicating whether or not the user knows the spell.
function HybrasylUser.HasSpell(spellname) end

---Send a system message ("orange message") to the current player.
---@param message string
function HybrasylUser.SystemMessage(message) end

---Indicates whether the current player is a peasant, or has an assigned class.
---@return boolean Boolean indicating whether or not current player is a peasant.
function HybrasylUser.IsPeasant() end

---Indicates whether the current player is in a guild.
---@return boolean Boolean indicating whether or not current player is in a guild.
function HybrasylUser.IsInGuild() end

---Sends a whisper ("blue message") from a given name to the current player.
---@param name string The name to be used for the whisper (e.g. who it is from)
---@param message string The message.
function HybrasylUser.Whisper(name, message) end

---Shout something as the user.
---@param message string The message to shout.
function HybrasylUser.Shout(message) end

---@param message string
---@param type number
function HybrasylUser.SendMessage(message, type) end

function HybrasylUser.EndDialog() end

---Start a dialog sequence for the current player. This will display the first dialog in the sequence to the player.
---@param sequenceName string The name of the sequence to start
---@param associateOverride? any An IInteractable to associate with the dialog as the origin.
function HybrasylUser.StartSequence(sequenceName, associateOverride) end

---Set a user's hairstyle from a script
---@param hairStyle number The target hairstyle
function HybrasylUser.SetHairstyle(hairStyle) end

---Set's a user's haircolor from a script
---@param itemColor string The color to apply
function HybrasylUser.SetHairColor(itemColor) end

---Trigger or clear a cooldown for a specific spell or skill.
---@param name string The name of the spell or skill
---@param clear? boolean Whether or not to trigger or clear. True clears; false triggers.
function HybrasylUser.SetCooldown(name, clear) end

---Send an update to the client that stats have changed.
function HybrasylUser.UpdateAttributes() end

---Apply a given status to a player.
---@param statusName string The name of the status
---@param duration? number The duration of the status, if zero, use default
---@param tick? number How often the tick should fire on the status (eg OnTick), if zero, use default
---@param intensity? number The intensity of the status (damage modifier), defaults to 1.0
---@return boolean boolean indicating whether or not the status was applied
function HybrasylUser.ApplyStatus(statusName, duration, tick, intensity) end

function HybrasylUser.RemoveAllStatuses() end

return HybrasylUser
