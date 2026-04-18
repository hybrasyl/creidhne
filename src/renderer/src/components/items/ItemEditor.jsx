import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  Tooltip,
  IconButton,
  Alert,
  Collapse,
  Paper,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Chip,
  Snackbar
} from '@mui/material'
import ConstantAutocomplete from '../shared/ConstantAutocomplete'
import EditorHeader from '../shared/EditorHeader'
import ItemSpritePicker from '../shared/ItemSpritePicker'
import DisplaySpritePicker from '../shared/DisplaySpritePicker'
import ColorSwatch from '../shared/ColorSwatch'
import { useItemColorSwatches } from '../../data/itemColorData'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'
import StatsTab from '../shared/StatsTab'
import RestrictionsTab from '../shared/RestrictionsTab'
import UseTab from './tabs/UseTab'
import {
  computeItemFilename,
  deriveItemPrefix,
  ITEM_TAGS,
  ITEM_BODY_STYLES,
  ITEM_COLORS,
  EQUIPMENT_SLOTS,
  WEAPON_TYPES,
  ITEM_FLAGS
} from '../../data/itemConstants'

const DEFAULT_EQUIPMENT = { slot: 'None', weaponType: 'None' }
const DEFAULT_DAMAGE = { smallMin: '0', smallMax: '0', largeMin: '0', largeMax: '0' }
const DEFAULT_USE = {
  script: '',
  teleport: null,
  effect: null,
  sound: null,
  statuses: { add: [], remove: [] }
}
const DEFAULT_CAST_MODIFIER = {
  group: '',
  castable: '',
  all: false,
  add: [],
  subtract: [],
  replace: []
}
const DEFAULT_OP = { match: '', amount: '0', min: '', max: '' }

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, open, onToggle, enabled, onEnable, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={onToggle}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        {onEnable !== undefined && (
          <Switch
            size="small"
            checked={enabled}
            onChange={(e) => {
              e.stopPropagation()
              onEnable(e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
            sx={{ mr: 0.5 }}
          />
        )}
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}

function deriveFilename(data) {
  return computeItemFilename(
    data.name,
    data.properties.equipment?.slot,
    data.properties.vendor?.shopTab
  )
}

function derivePrefix(data) {
  return deriveItemPrefix(data.properties.equipment?.slot, data.properties.vendor?.shopTab)
}

function ItemEditor({
  item,
  initialFileName,
  isArchived,
  isExisting,
  warnings = [],
  onSave,
  onArchive,
  onUnarchive,
  onDirtyChange,
  saveRef
}) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const colorSwatches = useItemColorSwatches()
  const castableNames = libraryIndex.castables || []
  const variantGroupNames = libraryIndex.variantgroups || []

  const [data, setData] = useState(item)
  const [fileName, setFileName] = useState(initialFileName || deriveFilename(item))
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [warningsDismissed, setWarningsDismissed] = useState(false)

  const [openFlags, setOpenFlags] = useState(item.properties.flags?.length > 0)
  const [openCategories, setOpenCategories] = useState(item.properties.categories?.length > 0)
  const [openAppearance, setOpenAppearance] = useState(true)
  const [openPhysical, setOpenPhysical] = useState(true)
  const [openRestrictions, setOpenRestrictions] = useState(true)
  const [openUse, setOpenUse] = useState(item.properties.use !== null)
  const [openVendor, setOpenVendor] = useState(true)

  const isDirtyRef = useRef(false)
  const [dupSnack, setDupSnack] = useState(null)

  useEffect(() => {
    setData(item)
    setFileName(initialFileName || deriveFilename(item))
    setFileNameEdited(!!initialFileName)
    setWarningsDismissed(false)
    setOpenFlags(item.properties.flags?.length > 0)
    setOpenCategories(item.properties.categories?.length > 0)
    setOpenUse(item.properties.use !== null)
    isDirtyRef.current = false
    setDupSnack(null)
    onDirtyChange?.(false)
  }, [item, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Duplicate detection ───────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim()
    if (!name) return null
    const originalName = isExisting ? item.name || '' : ''
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null
    const activeNames = libraryIndex?.items || []
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active'
    const archivedNames = libraryIndex?.archivedItems || []
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived'
    return null
  }, [data.name, libraryIndex, isExisting, item.name])

  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true
      onDirtyChange?.(true)
    }
  }, [onDirtyChange])

  const updateData = useCallback(
    (updater) => {
      markDirtyLocal()
      setData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!fileNameEdited) setFileName(deriveFilename(next))
        return next
      })
    },
    [fileNameEdited, markDirtyLocal]
  )

  const updateProperties = (slice) =>
    updateData((d) => ({ ...d, properties: { ...d.properties, ...slice } }))

  const setPropField = (key, field) => (e) =>
    updateData((d) => ({
      ...d,
      properties: { ...d.properties, [key]: { ...d.properties[key], [field]: e.target.value } }
    }))

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(deriveFilename(data))
    setFileNameEdited(false)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName)

  const enableEquipment = (checked) =>
    updateProperties({ equipment: checked ? { ...DEFAULT_EQUIPMENT } : null })

  const enableDamage = (checked) =>
    updateProperties({ damage: checked ? { ...DEFAULT_DAMAGE } : null })

  const enableUse = (checked) => {
    updateProperties({ use: checked ? { ...DEFAULT_USE } : null })
    setOpenUse(checked)
  }

  // ── Flags ──────────────────────────────────────────────────────────────────
  const toggleFlag = (flag) => {
    const next = p.flags.includes(flag) ? p.flags.filter((f) => f !== flag) : [...p.flags, flag]
    updateProperties({ flags: next })
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const addCategory = () =>
    updateProperties({ categories: [...p.categories, { name: '', unique: false }] })
  const setCategory = (index, val) =>
    updateProperties({
      categories: p.categories.map((c, i) => (i === index ? { ...c, name: val } : c))
    })
  const removeCategory = (index) =>
    updateProperties({ categories: p.categories.filter((_, i) => i !== index) })

  // ── Variant Groups ─────────────────────────────────────────────────────────
  const addVariantGroup = () =>
    updateProperties({ variants: { ...p.variants, groups: [...p.variants.groups, ''] } })
  const setVariantGroup = (index, val) =>
    updateProperties({
      variants: { ...p.variants, groups: p.variants.groups.map((g, i) => (i === index ? val : g)) }
    })
  const removeVariantGroup = (index) =>
    updateProperties({
      variants: { ...p.variants, groups: p.variants.groups.filter((_, i) => i !== index) }
    })

  // ── Cast Modifiers ─────────────────────────────────────────────────────────
  const addCastModifier = () =>
    updateProperties({ castModifiers: [...p.castModifiers, { ...DEFAULT_CAST_MODIFIER }] })
  const setCastModifier = (index, field, val) =>
    updateProperties({
      castModifiers: p.castModifiers.map((m, i) => (i === index ? { ...m, [field]: val } : m))
    })
  const removeCastModifier = (index) =>
    updateProperties({ castModifiers: p.castModifiers.filter((_, i) => i !== index) })

  const p = data.properties

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed item)'}
        entityLabel="item"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={deriveFilename(data)}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => {
          markDirtyLocal()
          setFileName(val)
          setFileNameEdited(true)
        }}
        onRegenerate={handleRegenerate}
        onSave={() => onSave(data, fileName)}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
      <Divider sx={{ mb: 1, flexShrink: 0 }} />
      {/* Warnings */}
      <Collapse in={warnings.length > 0 && !warningsDismissed} sx={{ flexShrink: 0 }}>
        <Alert severity="warning" onClose={() => setWarningsDismissed(true)} sx={{ mb: 1 }}>
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      </Collapse>
      {/* ── Form ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* ── Basic info ── */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Row 1: Prefix, Name, Unidentified Name */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="Prefix"
                value={derivePrefix(data)}
                sx={{ width: 120 }}
                slotProps={{
                  htmlInput: { readOnly: true },
                  inputLabel: { shrink: true }
                }} />
              <TextField
                label="Name"
                required
                value={data.name}
                size="small"
                onChange={(e) => updateData((d) => ({ ...d, name: e.target.value }))}
                onBlur={handleNameBlur}
                error={dupStatus === 'active'}
                helperText={
                  dupStatus === 'active'
                    ? `"${data.name}" already exists`
                    : dupStatus === 'archived'
                      ? `"${data.name}" exists in archive`
                      : undefined
                }
                sx={{
                  flex: 1,
                  minWidth: 160,
                  ...(dupStatus === 'archived' && {
                    '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                    '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
                    '& .MuiFormHelperText-root': { color: 'warning.main' }
                  })
                }}
                slotProps={{
                  htmlInput: { maxLength: 255 }
                }}
              />
              <TextField
                label="Unidentified Name"
                value={data.unidentifiedName}
                size="small"
                sx={{ flex: 1, minWidth: 160 }}
                onChange={(e) => updateData((d) => ({ ...d, unidentifiedName: e.target.value }))}
                slotProps={{
                  htmlInput: { maxLength: 255 }
                }}
              />
            </Box>
            {/* Row 2: Include in Metafile, Sold By, Found In */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={data.includeInMetafile}
                    onChange={(e) =>
                      updateData((d) => ({ ...d, includeInMetafile: e.target.checked }))
                    }
                  />
                }
                label="Include in Metafile"
                sx={{ m: 0 }}
              />
              <TextField
                label="Sold By"
                size="small"
                sx={{ flex: 1, minWidth: 160 }}
                value={
                  (libraryIndex.itemVendors?.[data.name?.toLowerCase()] || []).join(', ') ||
                  'Not sold by any NPC'
                }
                slotProps={{
                  htmlInput: { readOnly: true },
                  inputLabel: { shrink: true }
                }} />
              <TextField
                label="Found In"
                size="small"
                sx={{ flex: 1, minWidth: 160 }}
                value={
                  (libraryIndex.itemLootSets?.[data.name?.toLowerCase()] || []).join(', ') ||
                  'Not in any loot set'
                }
                slotProps={{
                  htmlInput: { readOnly: true },
                  inputLabel: { shrink: true }
                }} />
            </Box>
            {/* Row 3: Comment */}
            <TextField
              label="Comment"
              value={data.comment}
              size="small"
              multiline
              minRows={2}
              onChange={(e) => updateData((d) => ({ ...d, comment: e.target.value }))}
              slotProps={{
                htmlInput: { maxLength: 65534 }
              }}
            />
            <Autocomplete
              multiple
              options={ITEM_TAGS}
              value={p.tags}
              onChange={(_, val) => updateProperties({ tags: val })}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => (
                  <Chip key={option} label={option} size="small" {...getItemProps({ index })} />
                ))
              }
              renderInput={(params) => <TextField {...params} size="small" label="Tags" />}
            />
          </Box>
        </Paper>

        {/* ── Flags ── */}
        <Section title="Flags" open={openFlags} onToggle={() => setOpenFlags((v) => !v)}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            {ITEM_FLAGS.map((flag) => (
              <FormControlLabel
                key={flag}
                control={
                  <Checkbox
                    checked={p.flags.includes(flag)}
                    onChange={() => toggleFlag(flag)}
                    size="small"
                  />
                }
                label={<Typography variant="body2">{flag}</Typography>}
                sx={{ width: '33%', m: 0 }}
              />
            ))}
          </Box>
        </Section>

        {/* ── Categories ── */}
        <Section
          title="Categories"
          open={openCategories}
          onToggle={() => setOpenCategories((v) => !v)}
        >
          {p.categories.map((cat, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <ConstantAutocomplete
                indexKey="itemCategories"
                label="Category"
                value={cat.name}
                sx={{ flex: 1 }}
                onChange={(val) => setCategory(index, val)}
                inputProps={{ maxLength: 255 }}
              />
              <IconButton size="small" color="error" onClick={() => removeCategory(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addCategory}>
            Add Category
          </Button>
        </Section>

        {/* ── Appearance ── */}
        <Section
          title="Appearance"
          open={openAppearance}
          onToggle={() => setOpenAppearance((v) => !v)}
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <ItemSpritePicker
              value={p.appearance.sprite}
              onChange={(val) => setPropField('appearance', 'sprite')({ target: { value: val } })}
              required
              helpTooltip="Icon shown on the ground, in inventory, and in vendor menus."
            />
            <ItemSpritePicker
              label="Equip Sprite"
              value={p.appearance.equipSprite}
              onChange={(val) =>
                setPropField('appearance', 'equipSprite')({ target: { value: val } })
              }
              helpTooltip="Override for the icon shown on the paperdoll/inventory screen when equipped. Leave 0 to reuse Sprite."
            />
            <DisplaySpritePicker
              slot={p.equipment?.slot}
              value={p.appearance.displaySprite}
              onChange={(val) =>
                setPropField('appearance', 'displaySprite')({ target: { value: val } })
              }
              helpTooltip="Overlay applied to the character model. Only used for Weapon, Armor, Shield, Helmet, Foot, Trousers, Coat, SecondAcc, and ThirdAcc slots."
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Body Style</InputLabel>
              <Select
                value={p.appearance.bodyStyle}
                label="Body Style"
                onChange={setPropField('appearance', 'bodyStyle')}
              >
                {ITEM_BODY_STYLES.map((s) => (
                  <MenuItem key={s || '__blank'} value={s}>
                    {s || '(none)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Color</InputLabel>
              <Select
                value={p.appearance.color}
                label="Color"
                onChange={setPropField('appearance', 'color')}
                renderValue={(val) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{val || '(none)'}</span>
                    {colorSwatches && val && <ColorSwatch colors={colorSwatches.get(val)} />}
                  </Box>
                )}
              >
                {ITEM_COLORS.map((c) => (
                  <MenuItem key={c || '__blank'} value={c}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                      <span>{c || '(none)'}</span>
                      {colorSwatches && c && (
                        <Box sx={{ ml: 'auto' }}>
                          <ColorSwatch colors={colorSwatches.get(c)} />
                        </Box>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={p.appearance.hideBoots}
                  onChange={(e) =>
                    updateData((d) => ({
                      ...d,
                      properties: {
                        ...d.properties,
                        appearance: { ...d.properties.appearance, hideBoots: e.target.checked }
                      }
                    }))
                  }
                />
              }
              label="Hide Boots"
            />
          </Box>
        </Section>

        {/* ── Physical ── */}
        <Section title="Physical" open={openPhysical} onToggle={() => setOpenPhysical((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Physical fields */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Value"
                type="number"
                value={p.physical.value}
                size="small"
                sx={{ width: 130 }}
                onChange={setPropField('physical', 'value')}
                slotProps={{
                  htmlInput: { min: 0, step: 0.01 }
                }}
              />
              <TextField
                label="Weight"
                type="number"
                value={p.physical.weight}
                size="small"
                sx={{ width: 130 }}
                onChange={setPropField('physical', 'weight')}
                slotProps={{
                  htmlInput: { min: 0, step: 0.01 }
                }}
              />
              <TextField
                label="Durability"
                type="number"
                value={p.physical.durability}
                size="small"
                sx={{ width: 130 }}
                onChange={setPropField('physical', 'durability')}
                slotProps={{
                  htmlInput: { min: 0, step: 0.01 }
                }}
              />
              <TextField
                label="Stack Max"
                type="number"
                value={p.stackable.max}
                size="small"
                sx={{ width: 130 }}
                onChange={(e) => updateProperties({ stackable: { max: e.target.value } })}
                slotProps={{
                  htmlInput: { min: 1, max: 255 }
                }}
              />
            </Box>
            {p.physical.value ? (
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                Suggested sell price: {Math.round(Number(p.physical.value) / 5)} gold
              </Typography>
            ) : null}

            {/* Equipment sub-paper */}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', mb: p.equipment !== null ? 1.5 : 0 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Equipment
                </Typography>
                <Switch
                  size="small"
                  checked={p.equipment !== null}
                  onChange={(e) => enableEquipment(e.target.checked)}
                />
              </Box>
              {p.equipment !== null && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Slot</InputLabel>
                    <Select
                      value={p.equipment.slot}
                      label="Slot"
                      onChange={setPropField('equipment', 'slot')}
                    >
                      {EQUIPMENT_SLOTS.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Weapon Type</InputLabel>
                    <Select
                      value={p.equipment.weaponType}
                      label="Weapon Type"
                      onChange={setPropField('equipment', 'weaponType')}
                    >
                      {WEAPON_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Paper>

            {/* Stat Modifiers — only when equipment enabled and slot != None */}
            {p.equipment !== null && p.equipment.slot !== 'None' && (
              <StatsTab
                data={p.statModifiers}
                onChange={(updated) => updateProperties({ statModifiers: updated })}
                elementOptions={libraryIndex.elementnames || []}
              />
            )}

            {/* Damage — only when equipment enabled and weaponType != None */}
            {p.equipment !== null && p.equipment.weaponType !== 'None' && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', mb: p.damage !== null ? 1.5 : 0 }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    Damage
                  </Typography>
                  <Switch
                    size="small"
                    checked={p.damage !== null}
                    onChange={(e) => enableDamage(e.target.checked)}
                  />
                </Box>
                {p.damage !== null && (
                  <>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField
                        label="Small Min"
                        type="number"
                        value={p.damage.smallMin}
                        size="small"
                        sx={{ width: 130 }}
                        onChange={setPropField('damage', 'smallMin')}
                        slotProps={{
                          htmlInput: { step: 0.01 }
                        }}
                      />
                      <TextField
                        label="Small Max"
                        type="number"
                        value={p.damage.smallMax}
                        size="small"
                        sx={{ width: 130 }}
                        onChange={setPropField('damage', 'smallMax')}
                        slotProps={{
                          htmlInput: { step: 0.01 }
                        }}
                      />
                      <TextField
                        label="Large Min"
                        type="number"
                        value={p.damage.largeMin}
                        size="small"
                        sx={{ width: 130 }}
                        onChange={setPropField('damage', 'largeMin')}
                        slotProps={{
                          htmlInput: { step: 0.01 }
                        }}
                      />
                      <TextField
                        label="Large Max"
                        type="number"
                        value={p.damage.largeMax}
                        size="small"
                        sx={{ width: 130 }}
                        onChange={setPropField('damage', 'largeMax')}
                        slotProps={{
                          htmlInput: { step: 0.01 }
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      Average damage — Small:{' '}
                      {((Number(p.damage.smallMin) + Number(p.damage.smallMax)) / 2).toFixed(1)} /
                      Large:{' '}
                      {((Number(p.damage.largeMin) + Number(p.damage.largeMax)) / 2).toFixed(1)}
                    </Typography>
                  </>
                )}
              </Paper>
            )}

            {/* Cast Modifiers — only when equipment enabled and weaponType != None */}
            {p.equipment !== null && p.equipment.weaponType !== 'None' && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Cast Modifiers
                </Typography>
                {p.castModifiers.map((cm, cmIdx) => {
                  const updateOps = (field, ops) => setCastModifier(cmIdx, field, ops)
                  const addOp = (field) => updateOps(field, [...cm[field], { ...DEFAULT_OP }])
                  const setOp = (field, opIdx, key, val) =>
                    updateOps(
                      field,
                      cm[field].map((op, i) => (i === opIdx ? { ...op, [key]: val } : op))
                    )
                  const removeOp = (field, opIdx) =>
                    updateOps(
                      field,
                      cm[field].filter((_, i) => i !== opIdx)
                    )

                  return (
                    <Box
                      key={cmIdx}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          mb: 1
                        }}
                      >
                        <TextField
                          label="Group"
                          value={cm.group}
                          size="small"
                          sx={{ flex: 1, minWidth: 120 }}
                          onChange={(e) => setCastModifier(cmIdx, 'group', e.target.value)}
                          slotProps={{
                            htmlInput: { maxLength: 255 }
                          }}
                        />
                        <Autocomplete
                          freeSolo
                          options={castableNames}
                          value={cm.castable}
                          onInputChange={(_, val, reason) => {
                            if (reason === 'input') setCastModifier(cmIdx, 'castable', val)
                          }}
                          onChange={(_, val) => setCastModifier(cmIdx, 'castable', val ?? '')}
                          size="small"
                          sx={{ flex: 1, minWidth: 160 }}
                          renderInput={(params) => <TextField {...params} label="Castable" />}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={cm.all}
                              size="small"
                              onChange={(e) => setCastModifier(cmIdx, 'all', e.target.checked)}
                            />
                          }
                          label="All"
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeCastModifier(cmIdx)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      {['add', 'subtract', 'replace'].map((field) => (
                        <Box key={field} sx={{ pl: 1, mb: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              textTransform: 'capitalize'
                            }}>
                            {field}
                          </Typography>
                          {cm[field].map((op, opIdx) => (
                            <Box
                              key={opIdx}
                              sx={{
                                display: 'flex',
                                gap: 1,
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                mb: 0.5
                              }}
                            >
                              <TextField
                                label="Match"
                                value={op.match}
                                size="small"
                                sx={{ width: 100 }}
                                placeholder="-1"
                                onChange={(e) => setOp(field, opIdx, 'match', e.target.value)}
                              />
                              <TextField
                                label="Amount"
                                value={op.amount}
                                size="small"
                                sx={{ width: 100 }}
                                onChange={(e) => setOp(field, opIdx, 'amount', e.target.value)}
                              />
                              <TextField
                                label="Min"
                                value={op.min}
                                size="small"
                                sx={{ width: 90 }}
                                placeholder="-1"
                                onChange={(e) => setOp(field, opIdx, 'min', e.target.value)}
                              />
                              <TextField
                                label="Max"
                                value={op.max}
                                size="small"
                                sx={{ width: 90 }}
                                placeholder="255"
                                onChange={(e) => setOp(field, opIdx, 'max', e.target.value)}
                              />
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeOp(field, opIdx)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => addOp(field)}
                            sx={{ mt: 0.5 }}
                          >
                            Add {field}
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  );
                })}
                <Button startIcon={<AddIcon />} size="small" onClick={addCastModifier}>
                  Add Match
                </Button>
              </Paper>
            )}
          </Box>
        </Section>

        {/* ── Restrictions ── */}
        <Section
          title="Restrictions"
          open={openRestrictions}
          onToggle={() => setOpenRestrictions((v) => !v)}
        >
          <RestrictionsTab
            data={{ restrictions: p.restrictions }}
            onChange={(updated) => updateProperties(updated)}
          />
        </Section>

        {/* ── Use Effect (optional) ── */}
        <Section
          title="Use Effect"
          open={openUse}
          onToggle={() => setOpenUse((v) => !v)}
          enabled={p.use !== null}
          onEnable={enableUse}
        >
          <UseTab
            data={{ use: p.use, motions: p.motions, procs: p.procs }}
            onChange={(updated) => updateProperties(updated)}
          />
        </Section>

        {/* ── Vendor ── */}
        <Section title="Vendor" open={openVendor} onToggle={() => setOpenVendor((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Shop Tab also determines the bank tab name for this item.
            </Typography>
            <ConstantAutocomplete
              indexKey="vendorTabs"
              label="Shop Tab"
              value={p.vendor?.shopTab ?? ''}
              onChange={(val) =>
                updateProperties({ vendor: { ...(p.vendor ?? {}), shopTab: val } })
              }
              size="small"
              inputProps={{ maxLength: 255 }}
            />
            <TextField
              label="Description"
              value={p.vendor?.description ?? ''}
              size="small"
              multiline
              minRows={2}
              onChange={(e) =>
                updateProperties({ vendor: { ...(p.vendor ?? {}), description: e.target.value } })
              }
              slotProps={{
                htmlInput: { maxLength: 255 }
              }}
            />

            {/* Variant Groups */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Variant Groups
              </Typography>
              {p.variants.groups.map((group, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  <Autocomplete
                    options={variantGroupNames}
                    value={group || null}
                    onChange={(_, val) => setVariantGroup(index, val || '')}
                    size="small"
                    sx={{ flex: 1 }}
                    renderInput={(params) => <TextField {...params} label="Group Name" />}
                  />
                  <IconButton size="small" color="error" onClick={() => removeVariantGroup(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={addVariantGroup}>
                Add Variant Group
              </Button>
            </Box>
          </Box>
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>
      <Snackbar
        open={!!dupSnack}
        autoHideDuration={5000}
        onClose={() => setDupSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={dupSnack === 'archived' ? 'warning' : 'error'}
          onClose={() => setDupSnack(null)}
          sx={{ width: '100%' }}
        >
          {dupSnack === 'active'
            ? `"${data.name}" already exists!`
            : `"${data.name}" exists in archive`}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ItemEditor
