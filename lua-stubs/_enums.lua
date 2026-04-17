---@meta
---@diagnostic disable: missing-fields
-- Auto-generated enum stubs from Hybrasyl C# source.
-- MoonSharp exposes C# enums as table-like globals.

---@class CleanupType
---@field ByConnectionId CleanupType
---@field ByName CleanupType

---@type CleanupType
CleanupType = {}

---@class ClientType
---@field Client ClientType
---@field TestClient ClientType

---@type ClientType
ClientType = {}

---@class CombatLogEventType
---@field Unknown CombatLogEventType
---@field Dodge CombatLogEventType
---@field Damage CombatLogEventType
---@field Heal CombatLogEventType
---@field CriticalFailure CombatLogEventType
---@field CriticalMagicFailure CombatLogEventType
---@field ReflectMagical CombatLogEventType
---@field ReflectPhysical CombatLogEventType
---@field LifeSteal CombatLogEventType
---@field ManaSteal CombatLogEventType
---@field ConvertDamageToMp CombatLogEventType
---@field Loot CombatLogEventType
---@field StatusEffect CombatLogEventType

---@type CombatLogEventType
CombatLogEventType = {}

---@class ControlOpcode
---@field CleanupUser ControlOpcode
---@field SaveUser ControlOpcode
---@field ChaosRising ControlOpcode
---@field ShutdownServer ControlOpcode
---@field RegenUser ControlOpcode
---@field LogoffUser ControlOpcode
---@field MailNotifyUser ControlOpcode
---@field StatusTick ControlOpcode
---@field MonolithSpawn ControlOpcode
---@field MonolithControl ControlOpcode
---@field TriggerRefresh ControlOpcode
---@field HandleDeath ControlOpcode
---@field DialogRequest ControlOpcode
---@field GlobalMessage ControlOpcode
---@field RemoveReactor ControlOpcode
---@field ModifyStats ControlOpcode
---@field ProcessProc ControlOpcode
---@field UpdateUser ControlOpcode
---@field DisplayCreature ControlOpcode
---@field CombatLog ControlOpcode

---@type ControlOpcode
ControlOpcode = {}

---@class DialogObjectType
---@field Creature DialogObjectType
---@field ItemObject DialogObjectType
---@field Reactor DialogObjectType
---@field CastableObject DialogObjectType
---@field Asynchronous DialogObjectType

---@type DialogObjectType
DialogObjectType = {}

---@class ItemDropType
---@field Normal ItemDropType
---@field UserDeathPile ItemDropType
---@field MonsterLootPile ItemDropType

---@type ItemDropType
ItemDropType = {}

---@class ItemObjectType
---@field CanUse ItemObjectType
---@field CannotUse ItemObjectType
---@field Equipment ItemObjectType

---@type ItemObjectType
ItemObjectType = {}

---@class ItemSlots
---@field None ItemSlots
---@field Weapon ItemSlots
---@field Armor ItemSlots
---@field Shield ItemSlots
---@field Helmet ItemSlots
---@field Earring ItemSlots
---@field Necklace ItemSlots
---@field LHand ItemSlots
---@field RHand ItemSlots
---@field LArm ItemSlots
---@field RArm ItemSlots
---@field Waist ItemSlots
---@field Leg ItemSlots
---@field Foot ItemSlots
---@field FirstAcc ItemSlots
---@field Trousers ItemSlots
---@field Coat ItemSlots
---@field SecondAcc ItemSlots
---@field ThirdAcc ItemSlots
---@field Gauntlet ItemSlots
---@field Ring ItemSlots

---@type ItemSlots
ItemSlots = {}

---@class LanternSize
---@field None LanternSize
---@field Small LanternSize
---@field Large LanternSize

---@type LanternSize
LanternSize = {}

---@class LegendColor
---@field Aqua LegendColor
---@field White LegendColor
---@field Pink LegendColor
---@field Peony LegendColor
---@field LightOrange LegendColor
---@field Mahogany LegendColor
---@field Brass LegendColor
---@field LightYellow LegendColor
---@field Yellow LegendColor
---@field LightGreen LegendColor
---@field Teal LegendColor
---@field Blue LegendColor
---@field LightPink LegendColor
---@field DarkPurple LegendColor
---@field Lavender LegendColor
---@field Green LegendColor
---@field Orange LegendColor
---@field Brown LegendColor
---@field Red LegendColor

---@type LegendColor
LegendColor = {}

---@class LegendIcon
---@field Community LegendIcon
---@field Warrior LegendIcon
---@field Rogue LegendIcon
---@field Wizard LegendIcon
---@field Priest LegendIcon
---@field Monk LegendIcon
---@field Heart LegendIcon
---@field Victory LegendIcon

---@type LegendIcon
LegendIcon = {}

---@class MailFlags
---@field None MailFlags
---@field Parcel MailFlags
---@field Mail MailFlags

---@type MailFlags
MailFlags = {}

---@class MessageType
---@field Whisper MessageType
---@field System MessageType
---@field SystemOverhead MessageType
---@field SlateScrollbar MessageType
---@field Slate MessageType
---@field Group MessageType
---@field Guild MessageType
---@field Overhead MessageType

---@type MessageType
MessageType = {}

---@class MonsterType
---@field Normal MonsterType
---@field Nonsolid MonsterType
---@field Merchant MonsterType
---@field Guardian MonsterType
---@field Reactor MonsterType

---@type MonsterType
MonsterType = {}

---@class NameDisplayStyle
---@field GreyHover NameDisplayStyle
---@field RedAlwaysOn NameDisplayStyle
---@field GreenHover NameDisplayStyle
---@field GreyAlwaysOn NameDisplayStyle

---@type NameDisplayStyle
NameDisplayStyle = {}

---@class PaperType
---@field Brown PaperType
---@field Gold PaperType
---@field Silver PaperType

---@type PaperType
PaperType = {}

---@class PlayerFlags
---@field Alive PlayerFlags
---@field InExchange PlayerFlags
---@field InDialog PlayerFlags
---@field Casting PlayerFlags
---@field Pvp PlayerFlags
---@field InBoard PlayerFlags
---@field AliveExchange PlayerFlags
---@field ProhibitCast PlayerFlags

---@type PlayerFlags
PlayerFlags = {}

---@class PrivateMessageType
---@field Whisper PrivateMessageType
---@field ServerMessage PrivateMessageType
---@field GlobalMessage PrivateMessageType
---@field ClearMessage PrivateMessageType
---@field PopupWithScroll PrivateMessageType
---@field PopupOkCancel PrivateMessageType
---@field UpperRight PrivateMessageType

---@type PrivateMessageType
PrivateMessageType = {}

---@class PublicMessageType
---@field Say PublicMessageType
---@field Shout PublicMessageType
---@field Spell PublicMessageType

---@type PublicMessageType
PublicMessageType = {}

---@class RestPosition
---@field Standing RestPosition
---@field RestPosition1 RestPosition
---@field RestPosition2 RestPosition
---@field MaximumChill RestPosition

---@type RestPosition
RestPosition = {}

---@class SkinColor
---@field Basic SkinColor
---@field White SkinColor
---@field Cocoa SkinColor
---@field Orc SkinColor
---@field Yellow SkinColor
---@field Tan SkinColor
---@field Grey SkinColor
---@field LightBlue SkinColor
---@field Orange SkinColor
---@field Purple SkinColor

---@type SkinColor
SkinColor = {}

---@class SpawnCastType
---@field Offensive SpawnCastType
---@field Defensive SpawnCastType
---@field NearDeath SpawnCastType
---@field OnDeath SpawnCastType

---@type SpawnCastType
SpawnCastType = {}

---@class StatUpdateFlags
---@field UnreadMail StatUpdateFlags
---@field Unknown StatUpdateFlags
---@field Secondary StatUpdateFlags
---@field Experience StatUpdateFlags
---@field Current StatUpdateFlags
---@field Primary StatUpdateFlags
---@field GameMasterA StatUpdateFlags
---@field GameMasterB StatUpdateFlags
---@field Swimming StatUpdateFlags
---@field Stats StatUpdateFlags
---@field Full StatUpdateFlags

---@type StatUpdateFlags
StatUpdateFlags = {}

---@class StatusBarColor
---@field Off StatusBarColor
---@field Blue StatusBarColor
---@field Green StatusBarColor
---@field Orange StatusBarColor
---@field Red StatusBarColor
---@field White StatusBarColor

---@type StatusBarColor
StatusBarColor = {}

---@class TextColor
---@field Red TextColor
---@field Yellow TextColor
---@field DarkBlue TextColor
---@field DarkGrey TextColor
---@field MediumGrey TextColor
---@field LightGrey TextColor
---@field DarkPurple TextColor
---@field BrightGreen TextColor
---@field DarkGreen TextColor
---@field Orange TextColor
---@field DarkOrange TextColor
---@field White TextColor
---@field Blue TextColor
---@field WhisperBlue TextColor
---@field Pink TextColor

---@type TextColor
TextColor = {}

---@class ThrottleResult
---@field OK ThrottleResult
---@field Throttled ThrottleResult
---@field Squelched ThrottleResult
---@field Disconnect ThrottleResult
---@field ThrottleEnd ThrottleResult
---@field SquelchEnd ThrottleResult
---@field Error ThrottleResult

---@type ThrottleResult
ThrottleResult = {}

---@class UserStatus
---@field Awake UserStatus
---@field DoNotDisturb UserStatus
---@field DayDreaming UserStatus
---@field NeedGroup UserStatus
---@field Grouped UserStatus
---@field LoneHunter UserStatus
---@field GroupHunter UserStatus
---@field NeedHelp UserStatus

---@type UserStatus
UserStatus = {}

---@class WarpType
---@field Map WarpType
---@field WorldMap WarpType

---@type WarpType
WarpType = {}

---@class BoardType
---@field Messageboard BoardType
---@field Sign BoardType

---@type BoardType
BoardType = {}

---@class Book
---@field PrimarySkill Book
---@field SecondarySkill Book
---@field UtilitySkill Book
---@field PrimarySpell Book
---@field SecondarySpell Book
---@field UtilitySpell Book

---@type Book
Book = {}

---@class Class
---@field Peasant Class
---@field Warrior Class
---@field Rogue Class
---@field Wizard Class
---@field Priest Class
---@field Monk Class
---@field None Class

---@type Class
Class = {}

---@class CreatureCondition
---@field Stun CreatureCondition
---@field Sleep CreatureCondition
---@field Root CreatureCondition
---@field Blind CreatureCondition
---@field Coma CreatureCondition
---@field Poison CreatureCondition
---@field Sight CreatureCondition
---@field Invisible CreatureCondition
---@field Mute CreatureCondition
---@field Invulnerable CreatureCondition
---@field Charm CreatureCondition
---@field ProhibitItemUse CreatureCondition
---@field ProhibitEquipChange CreatureCondition
---@field ProhibitSpeech CreatureCondition
---@field ProhibitWhisper CreatureCondition
---@field ProhibitShout CreatureCondition
---@field Disoriented CreatureCondition
---@field Disarm CreatureCondition
---@field Fear CreatureCondition
---@field ProhibitHpRegen CreatureCondition
---@field ProhibitMpRegen CreatureCondition
---@field ProhibitHpIncrease CreatureCondition
---@field ProhibitMpIncrease CreatureCondition
---@field ProhibitMpDecrease CreatureCondition
---@field ProhibitXpIncrease CreatureCondition

---@type CreatureCondition
CreatureCondition = {}

---@class CreatureImmunityType
---@field Element CreatureImmunityType
---@field Castable CreatureImmunityType
---@field Status CreatureImmunityType
---@field StatusCategory CreatureImmunityType
---@field CastableCategory CreatureImmunityType

---@type CreatureImmunityType
CreatureImmunityType = {}

---@class CreatureTargetPriority
---@field None CreatureTargetPriority
---@field Self CreatureTargetPriority
---@field AllAllies CreatureTargetPriority
---@field RandomAlly CreatureTargetPriority
---@field Attacker CreatureTargetPriority
---@field HighThreat CreatureTargetPriority
---@field LowThreat CreatureTargetPriority
---@field AttackingCaster CreatureTargetPriority
---@field AttackingHealer CreatureTargetPriority
---@field RandomAttacker CreatureTargetPriority
---@field AttackingGroup CreatureTargetPriority
---@field AllyWithLowestHp CreatureTargetPriority
---@field AllyWithLowestMp CreatureTargetPriority
---@field AllyWithHighestHp CreatureTargetPriority
---@field AllyWithHighestMp CreatureTargetPriority
---@field AllyWithLessThanMaxHp CreatureTargetPriority
---@field AllyWithLessThanMaxMp CreatureTargetPriority
---@field AllyWithStatusConditions CreatureTargetPriority
---@field AllyWithNoStatusConditions CreatureTargetPriority

---@type CreatureTargetPriority
CreatureTargetPriority = {}

---@class DamageFlags
---@field None DamageFlags
---@field NoResistance DamageFlags
---@field NoThreat DamageFlags
---@field Nonlethal DamageFlags
---@field NoDodge DamageFlags
---@field NoCrit DamageFlags
---@field NoElement DamageFlags

---@type DamageFlags
DamageFlags = {}

---@class DamageType
---@field Direct DamageType
---@field Physical DamageType
---@field Magical DamageType
---@field Elemental DamageType

---@type DamageType
DamageType = {}

---@class Direction
---@field North Direction
---@field East Direction
---@field South Direction
---@field West Direction

---@type Direction
Direction = {}

---@class ElementalModifierType
---@field Augment ElementalModifierType
---@field Resistance ElementalModifierType

---@type ElementalModifierType
ElementalModifierType = {}

---@class ElementType
---@field None ElementType
---@field Fire ElementType
---@field Water ElementType
---@field Wind ElementType
---@field Earth ElementType
---@field Light ElementType
---@field Dark ElementType
---@field Wood ElementType
---@field Metal ElementType
---@field Undead ElementType
---@field RandomTemuair ElementType
---@field RandomExpanded ElementType
---@field Necklace ElementType
---@field Belt ElementType
---@field Current ElementType

---@type ElementType
ElementType = {}

---@class EquipmentSlot
---@field None EquipmentSlot
---@field Weapon EquipmentSlot
---@field Armor EquipmentSlot
---@field Shield EquipmentSlot
---@field Helmet EquipmentSlot
---@field Earring EquipmentSlot
---@field Necklace EquipmentSlot
---@field LeftHand EquipmentSlot
---@field RightHand EquipmentSlot
---@field LeftArm EquipmentSlot
---@field RightArm EquipmentSlot
---@field Waist EquipmentSlot
---@field Leg EquipmentSlot
---@field Foot EquipmentSlot
---@field FirstAcc EquipmentSlot
---@field Trousers EquipmentSlot
---@field Coat EquipmentSlot
---@field SecondAcc EquipmentSlot
---@field ThirdAcc EquipmentSlot
---@field Gauntlet EquipmentSlot
---@field Ring EquipmentSlot

---@type EquipmentSlot
EquipmentSlot = {}

---@class Gender
---@field Neutral Gender
---@field Male Gender
---@field Female Gender

---@type Gender
Gender = {}

---@class IntentDirection
---@field None IntentDirection
---@field Front IntentDirection
---@field Back IntentDirection
---@field Left IntentDirection
---@field Right IntentDirection

---@type IntentDirection
IntentDirection = {}

---@class IntentFlags
---@field Hostile IntentFlags
---@field Friendly IntentFlags
---@field Pvp IntentFlags
---@field Group IntentFlags
---@field Self IntentFlags

---@type IntentFlags
IntentFlags = {}

---@class ItemBodyStyle
---@field Transparent ItemBodyStyle
---@field Male ItemBodyStyle
---@field MaleBlack ItemBodyStyle
---@field MaleRed ItemBodyStyle
---@field Female ItemBodyStyle

---@type ItemBodyStyle
ItemBodyStyle = {}

---@class ItemColor
---@field None ItemColor
---@field Black ItemColor
---@field Red ItemColor
---@field Auburn ItemColor
---@field Butter ItemColor
---@field Aqua ItemColor
---@field Blue ItemColor
---@field Plum ItemColor
---@field Forest ItemColor
---@field Green ItemColor
---@field Sienna ItemColor
---@field Brown ItemColor
---@field Charcoal ItemColor
---@field Navy ItemColor
---@field Acorn ItemColor
---@field White ItemColor
---@field Pink ItemColor
---@field Honeydew ItemColor
---@field Orange ItemColor
---@field Platinum ItemColor
---@field Midnight ItemColor
---@field Orchid ItemColor
---@field Lavender ItemColor
---@field Fuschia ItemColor
---@field Cerise ItemColor
---@field Ocean ItemColor
---@field HotPink ItemColor
---@field Seafoam ItemColor
---@field Amethyst ItemColor
---@field Peach ItemColor
---@field Sky ItemColor
---@field Lime ItemColor
---@field Jade ItemColor
---@field Honey ItemColor
---@field Cobalt ItemColor
---@field Cocoa ItemColor
---@field Wine ItemColor
---@field Kelp ItemColor
---@field Wine2 ItemColor
---@field Teal ItemColor
---@field Copper ItemColor
---@field Curry ItemColor
---@field Moss ItemColor
---@field Grass ItemColor
---@field Lapis ItemColor
---@field Maroon ItemColor
---@field TiNfOiL ItemColor
---@field Aquamarine ItemColor
---@field Leaf ItemColor
---@field Purple ItemColor
---@field Scarlet ItemColor
---@field Lemon ItemColor
---@field Puce ItemColor
---@field Coral ItemColor
---@field Crimson ItemColor
---@field Gold ItemColor
---@field Silver ItemColor
---@field Fire ItemColor
---@field Stormy ItemColor
---@field Cherry ItemColor
---@field Mint ItemColor
---@field Cerulean ItemColor
---@field Twilight ItemColor
---@field Quartz ItemColor
---@field Turquoise ItemColor
---@field Peridot ItemColor
---@field Nebula ItemColor
---@field Bubblegum ItemColor
---@field Cyan ItemColor
---@field Sable ItemColor
---@field Mauve ItemColor
---@field Dusk ItemColor

---@type ItemColor
ItemColor = {}

---@class ItemFlags
---@field Bound ItemFlags
---@field Depositable ItemFlags
---@field Enchantable ItemFlags
---@field Consecratable ItemFlags
---@field Tailorable ItemFlags
---@field Smithable ItemFlags
---@field Exchangeable ItemFlags
---@field Vendorable ItemFlags
---@field Perishable ItemFlags
---@field UniqueInventory ItemFlags
---@field MasterOnly ItemFlags
---@field UniqueEquipped ItemFlags
---@field Identifiable ItemFlags
---@field Undamageable ItemFlags
---@field Consumable ItemFlags

---@type ItemFlags
ItemFlags = {}

---@class ItemTag
---@field Junk ItemTag
---@field Common ItemTag
---@field Reagent ItemTag
---@field Magic ItemTag
---@field Rare ItemTag
---@field Masterwork ItemTag
---@field Legendary ItemTag
---@field Artifact ItemTag
---@field Religious ItemTag
---@field Social ItemTag
---@field Academic ItemTag
---@field Quest ItemTag
---@field Political ItemTag
---@field Currency ItemTag
---@field Peasantware ItemTag
---@field Armor ItemTag
---@field Weapon ItemTag
---@field Contraption ItemTag
---@field Food ItemTag
---@field Tool ItemTag
---@field Adornment ItemTag

---@type ItemTag
ItemTag = {}

---@class LogLevel
---@field All LogLevel
---@field Debug LogLevel
---@field Info LogLevel
---@field Warn LogLevel
---@field Error LogLevel
---@field Fatal LogLevel
---@field None LogLevel

---@type LogLevel
LogLevel = {}

---@class LogType
---@field General LogType
---@field Scripting LogType
---@field GmActivity LogType
---@field UserActivity LogType
---@field Spawn LogType
---@field Packet LogType
---@field WorldData LogType

---@type LogType
LogType = {}

---@class MapFlags
---@field Snow MapFlags
---@field Rain MapFlags
---@field Dark MapFlags
---@field NoMap MapFlags
---@field Winter MapFlags

---@type MapFlags
MapFlags = {}

---@class MasteryModifier
---@field Damage MasteryModifier
---@field Heal MasteryModifier
---@field MissRate MasteryModifier
---@field FailRate MasteryModifier

---@type MasteryModifier
MasteryModifier = {}

---@class MessageType
---@field Mail MessageType
---@field BoardMessage MessageType
---@field Say MessageType
---@field Shout MessageType
---@field Whisper MessageType
---@field GuildChat MessageType
---@field GroupChat MessageType
---@field RegionalChat MessageType
---@field GMChat MessageType

---@type MessageType
MessageType = {}

---@class NpcRepairType
---@field Armor NpcRepairType
---@field Weapon NpcRepairType
---@field All NpcRepairType

---@type NpcRepairType
NpcRepairType = {}

---@class ProcEventType
---@field OnUse ProcEventType
---@field OnCast ProcEventType
---@field OnHit ProcEventType
---@field OnDeath ProcEventType
---@field OnSpawn ProcEventType

---@type ProcEventType
ProcEventType = {}

---@class RestrictionType
---@field Equipped RestrictionType
---@field NotEquipped RestrictionType
---@field InInventory RestrictionType
---@field NotInInventory RestrictionType

---@type RestrictionType
RestrictionType = {}

---@class RotationType
---@field Offense RotationType
---@field Defense RotationType
---@field OnDeath RotationType
---@field NearDeath RotationType
---@field Assail RotationType

---@type RotationType
RotationType = {}

---@class ScriptSource
---@field Target ScriptSource
---@field Caster ScriptSource

---@type ScriptSource
ScriptSource = {}

---@class SlotRestrictionType
---@field ItemRequired SlotRestrictionType
---@field ItemProhibited SlotRestrictionType

---@type SlotRestrictionType
SlotRestrictionType = {}

---@class SpawnFlags
---@field Active SpawnFlags
---@field MovementDisabled SpawnFlags
---@field AiDisabled SpawnFlags
---@field DeathDisabled SpawnFlags

---@type SpawnFlags
SpawnFlags = {}

---@class SpellUseType
---@field Unusable SpellUseType
---@field Prompt SpellUseType
---@field Target SpellUseType
---@field FourDigit SpellUseType
---@field ThreeDigit SpellUseType
---@field NoTarget SpellUseType
---@field TwoDigit SpellUseType
---@field OneDigit SpellUseType

---@type SpellUseType
SpellUseType = {}

---@class VisualEffectType
---@field Targets VisualEffectType
---@field AllTiles VisualEffectType
---@field Caster VisualEffectType

---@type VisualEffectType
VisualEffectType = {}

---@class WeaponType
---@field OneHand WeaponType
---@field TwoHand WeaponType
---@field Dagger WeaponType
---@field Staff WeaponType
---@field Claw WeaponType
---@field None WeaponType

---@type WeaponType
WeaponType = {}
