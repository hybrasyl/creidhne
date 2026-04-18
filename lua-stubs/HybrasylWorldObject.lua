-- Generated from Subsystems/Scripting/HybrasylWorldObject.cs
-- Do not edit manually — regenerate with: node scripts/generate-lua-stubs.js

---@class HybrasylWorldObject
---@field Obj WorldObject
---@field IsPlayer boolean
---@field Guid string
---@field LocationDescription string
---@field WorldObject IWorldObject
---@field Name string
---@field Type string
---The current X coordinate location of the object.
---@field X number
---The current Y coordinate location of the object.
---@field Y number
local HybrasylWorldObject = {}


---@param x string
function HybrasylWorldObject.DebugFunction(x) end

---Set the default sprite for this world object to a specified creature sprite.
---@param displaySprite number Integer referencing a creature sprite in the client datfiles.
function HybrasylWorldObject.SetNpcDisplaySprite(displaySprite) end

---Set the default sprite for this world object to a specified item sprite.
---@param displaySprite number Integer referencing a creature sprite in the client datfiles.
function HybrasylWorldObject.SetItemDisplaySprite(displaySprite) end

---Return a localized string given a key
---@param key string The key to return. Note that NPCs can override localized strings, which take precedence.
---@return string The localized string for a given key
function HybrasylWorldObject.GetLocalString(key) end

---Display a main menu (pursuit list) to a player.
---@param invoker any The object invoking the pursuit list (e.g. a player that clicked on the NPC, item, etc)
function HybrasylWorldObject.DisplayPursuits(invoker) end

---Permanently destroy this object, if the underlying type is an item, or gold.
function HybrasylWorldObject.Destroy() end

---Add a main menu item (pursuit) to this object's menu list.
---@param hybrasylSequence HybrasylDialogSequence
function HybrasylWorldObject.AddPursuit(hybrasylSequence) end

---Set a value in an *object's* ephemeral store. The store lasts for the lifetime of the object (for mobs, until they're killed; for NPCs, most likely until server restart, for players, while they're logged in). This is effectively NPC state memory that is player independent.
---@param key string The key we will store
---@param value any The value (dynamic) we want to store
function HybrasylWorldObject.SetEphemeral(key, value) end

---Set a scoped value in an *object's* ephemeral store. The store lasts for the lifetime of the object (for mobs, until they're killed; for NPCs, most likely until server restart, for players, while they're logged in). This is effectively NPC state memory that is player independent. Scoped means it is tied to a specific user.
---@param user string
---@param key string The key we will store
---@param value any The value (dynamic) we want to store
function HybrasylWorldObject.SetScopedEphemeral(user, key, value) end

---Remove the specified key from the object's ephemeral store.
---@param key string
function HybrasylWorldObject.ClearEphemeral(key) end

---Get the value of a specified key from the object's ephemeral store.
---@param key string The key to retrieve
---@return any dynamic value
function HybrasylWorldObject.GetEphemeral(key) end

---Get the value of a scoped ephemeral (a value stored scoped to a specific player) from the object's ephemeral store.
---@param user string The user for the scope
---@param key string The key to retrieve
---@return any dynamic value
function HybrasylWorldObject.GetScopedEphemeral(user, key) end

---Register a constructed dialog sequence with the current world object, which makes it available for use by that object. Dialogs must be registered before they can be used.
---@param hybrasylSequence HybrasylDialogSequence
function HybrasylWorldObject.RegisterSequence(hybrasylSequence) end

---Calculate the Manhattan distance between the current world object and a target object. Assumes objects are on the same map, otherwise the calculation is meaningless.
---@param target HybrasylWorldObject The target object
---@return number
function HybrasylWorldObject.Distance(target) end

---Request an asynchronous dialog with a player. This can be used to ask a different player a question (such as for mentoring, etc).
---@param targetUser string The logged-in player that will receive the dialog
---@param sourceGuid string The GUID of the source (player, merchant, etc)
---@param sequenceName string The sequence that will be started for the target player
---@param originGuid string The GUID of the origin for the request (castable, item, merchant, whatever). The origin must contain the script that will be used to handle the request.
---@param requireLocal? boolean Whether or not the player needs to be on the same map as the player causing the request.
---@return boolean Boolean indicating success
function HybrasylWorldObject.RequestDialog(targetUser, sourceGuid, sequenceName, originGuid, requireLocal) end

---Speak as the current world object ("white message").
---@param message string The text to be spoken
function HybrasylWorldObject.Say(message) end

---Refresh this object to a player. Can be used for sprite / other display changes.
---@param user HybrasylUser User object that will receive the update.
function HybrasylWorldObject.ShowTo(user) end

---Gets the objects facing direction.
---@return Direction Returns the direction for all world objects, if a form of creature (merchant, monster, user) returns direction, all others return north.
function HybrasylWorldObject.GetFacingDirection() end

---Checks the specified X/Y point is free of creatures and is not a wall, if the object is a creature base type.
---@param x number
---@param y number
---@return boolean true/false
function HybrasylWorldObject.IsFreePoint(x, y) end

---Display a special effect visible to players.
---@param effect number ushort id of effect (references client datfile)
---@param speed? number speed of the effect (generally 100)
---@param global? boolean boolean indicating whether or not other players can see the effect, or just the player displaying the effect
function HybrasylWorldObject.DisplayEffect(effect, speed, global) end

---Display an effect at a given x,y coordinate on the current player's map.
---@param x number X coordinate where effect will be displayed
---@param y number Y coordinate where effect will be displayed
---@param effect number ushort id of effect (references client datfile)
---@param speed? number speed of the effect (generally 100)
---@param global? boolean boolean indicating whether or not other players can see the effect, or just the player displaying boolean indicating whether or not other players can see the effect, or just the player displaying the effect
function HybrasylWorldObject.DisplayEffectAtCoords(x, y, effect, speed, global) end

---Play a sound effect.
---@param sound number byte id of the sound, referencing a sound effect in client datfiles.
function HybrasylWorldObject.SoundEffect(sound) end

---Change the sprite of an object in the world. A Show() is automatically called to display the new sprite to any nearby players.
---@param sprite number ushort id of the sprite, referencing a sprite in client datfiles.
function HybrasylWorldObject.SetSprite(sprite) end

---Teleport the object to an x,y coordinate location on the specified map.
---@param location string The map name
---@param x number X coordinate target
---@param y number Y coordinate target
function HybrasylWorldObject.Teleport(location, x, y) end

---Teleport the object to an x,y coordinate location on its current map.
---@param x number
---@param y number
function HybrasylWorldObject.TeleportToCoords(x, y) end

return HybrasylWorldObject
