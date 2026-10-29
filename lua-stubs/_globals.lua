---@meta
---@diagnostic disable
-- Hybrasyl magic globals. Each entry says which scripts the server sets it in.
-- Types these so sumneko can provide IntelliSense on source.XXX, world.XXX, etc.
-- Hand-written: the generator does not produce this file. Checked against
-- ScriptEnvironment.Create and env.Add in the server (HTOO-576).

---The current player interacting with the NPC/item/castable.
---In dialog callbacks, this is the player who triggered the dialog.
---In reactor scripts, this is the reactor — use `---@cast source HybrasylReactor` at top of file.
---@type HybrasylUser
source = {}

---Only in reactor scripts: a snapshot of the creature that placed the reactor.
---Castable scripts do not get it; there the caster is `source`.
---@type CreatureSnapshot
caster = {}

---The server does not set this. In a reactor script, the creature that
---triggered the reactor is `target`; in an NPC or item script, the player is `source`.
---@deprecated
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

---The server does not set this. Use the `Map` of `origin` or `source`.
---@deprecated
---@type HybrasylMap
map = {}

---Element enum alias — scripts use `Element.Fire` but the C# type is `ElementType`.
---@type ElementType
Element = {}

---The text or selection the player entered in the most recent dialog callback.
---Set automatically before dialog handler functions are called.
---@type string
player_response = ""

---In an options dialog callback: the number of the option the player chose,
---as a string. `player_response` holds the option's text.
---@type string
player_selection = ""

---The name of the currently executing script file (without path or extension).
---@type string
this_script = ""

---In OnHear handlers: the text that the speaker said or shouted.
---@type string
text = ""

---In OnHear handlers: true when the speaker shouted.
---@type boolean
shout = false

---In OnHear handlers: the whole spoken event.
---@type SpokenEvent
event = {}

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
