---@meta
---@diagnostic disable: missing-fields
-- Hybrasyl magic globals — available in all script contexts.
-- Types these so sumneko can provide IntelliSense on source.XXX, world.XXX, etc.

---The current player interacting with the NPC/item/castable.
---In dialog callbacks, this is the player who triggered the dialog.
---In reactor scripts, this is the reactor — use `---@cast source HybrasylReactor` at top of file.
---@type HybrasylUser
source = {}

---The entity that cast the spell/skill. Available in castable scripts.
---@type HybrasylUser
caster = {}

---The entity that invoked/used the item or reactor. Available in item/reactor scripts.
---@type HybrasylUser
invoker = {}

---The target of the current action (if applicable).
---For targeted spells/skills, this is the entity being targeted.
---@type HybrasylUser
target = {}

---The NPC or entity that owns this script.
---Could be an NPC (HybrasylInteractable), a player, a monster, or any world object.
---All share the HybrasylWorldObject base (RegisterSequence, Say, SetEphemeral, etc.).
---@type HybrasylWorldObject
origin = {}

---The world object — access to global server functions, dialog builders,
---user lookups, time, logging, and more.
---@type HybrasylWorld
world = {}

---Utility functions — time helpers, random number generation, etc.
---@type HybrasylUtility
utility = {}

---The item being used/interacted with. Available in item scripts.
---@type HybrasylItemObject
item = {}

---The castable (spell/skill) being executed. Available in castable scripts.
---@type CastableObject
castable = {}

---Script logger — write to the server's script diagnostic log.
---@type ScriptLogger
logger = {}

---The map the script is executing on. Available in map/reactor scripts.
---@type HybrasylMap
map = {}

---Element enum alias — scripts use `Element.Fire` but the C# type is `ElementType`.
---@type ElementType
Element = {}

---The text or selection the player entered in the most recent dialog callback.
---Set automatically before dialog handler functions are called.
---@type string
player_response = ""

---The name of the currently executing script file (without path or extension).
---@type string
this_script = ""

---The text from a player's /say command, available in NPC OnSay handlers.
---@type string
text = ""

---The damage event object, injected into OnDamage() creature script handlers.
---Contains Amount, Element, and combat log details.
---@type DamageEvent
damage = {}

---The heal event object, injected into OnHeal() creature script handlers.
---Contains Amount and combat log details.
---@type HealEvent
heal = {}

---Shortcut for world:CurrentTime() — returns the current in-game time.
---@return HybrasylTime
function CurrentTime() end
