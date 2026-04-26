import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  TextField,
  IconButton,
  Tooltip,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  InputAdornment,
  Alert,
  CircularProgress
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRecoilValue, useRecoilState } from 'recoil'
import { activeLibraryState, libraryIndexState } from '../recoil/atoms'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'

const EMPTY_CONSTANTS = {
  vendorTabs: [],
  itemCategories: [],
  castableCategories: [],
  statusCategories: [],
  cookies: [],
  npcJobs: [],
  creatureFamilies: [],
  motions: [],
  spellBooks: [],
  weapons: []
}

// ─── Simple Types Tab ──────────────────────────────────────────────────────────

function SimpleTypesTab() {
  const [xsdTypes, setXsdTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    window.electronAPI
      .loadXsdTypes()
      .then((types) => {
        setXsdTypes(types)
        if (types.length) setSelected(types[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? xsdTypes.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : xsdTypes

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: type list */}
      <Box
        sx={{
          width: 240,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Filter types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }
            }}
          />
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <List dense disablePadding sx={{ flex: 1, overflow: 'auto' }}>
            {filtered.map((type) => (
              <ListItem key={type.name} disablePadding>
                <ListItemButton
                  selected={selected?.name === type.name}
                  onClick={() => setSelected(type)}
                >
                  <ListItemText
                    primary={type.name}
                    secondary={type.sourceFile}
                    slotProps={{
                      primary: { noWrap: true, variant: 'body2' },
                      secondary: { noWrap: true, variant: 'caption' }
                    }} />
                </ListItemButton>
              </ListItem>
            ))}
            {filtered.length === 0 && !loading && (
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  p: 2
                }}>
                No matches.
              </Typography>
            )}
          </List>
        )}
      </Box>
      {/* Right: values table */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">{selected.name}</Typography>
              {selected.isList && (
                <Chip size="small" label="flags list" color="info" variant="outlined" />
              )}
              <Chip size="small" label={selected.sourceFile} variant="outlined" />
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  ml: 'auto'
                }}>
                {selected.values.length} value{selected.values.length !== 1 ? 's' : ''}
                {selected.isList ? ' — combinable' : ''}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selected.values.map((v) => (
                    <TableRow key={v} hover>
                      <TableCell>
                        <Typography variant="body2">{v}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography sx={{
              color: "text.secondary"
            }}>Select a type to view its values.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Vendor Tabs Tab ───────────────────────────────────────────────────────────

function VendorTabsTab({ vendorTabs, onChange, activeLibrary, initialDetails, onIndexUpdated }) {
  const [newTab, setNewTab] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanData, setScanData] = useState(initialDetails || null)

  const handleAdd = () => {
    const val = newTab.trim()
    if (!val || vendorTabs.includes(val)) return
    onChange([...vendorTabs, val].sort())
    setNewTab('')
  }

  const handleScan = async () => {
    if (!activeLibrary) return
    setScanning(true)
    try {
      const details = await window.electronAPI.scanVendorTabs(activeLibrary)
      setScanData(details)
      const scannedNames = details.map((d) => d.name)
      const merged = [...new Set([...vendorTabs, ...scannedNames])].sort()
      onChange(merged)
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary)
      if (updatedIndex) onIndexUpdated(updatedIndex)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const rows = useMemo(() => {
    const scanMap = {}
    if (scanData)
      scanData.forEach((r) => {
        scanMap[r.name] = r
      })
    return vendorTabs.map((name) => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? []
    }))
  }, [vendorTabs, scanData])

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            flex: 1
          }}>
          Vendor tab names used on item definitions (<code>Vendor/@ShopTab</code>).
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan}
          disabled={scanning || !activeLibrary}
        >
          Scan Items
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Set an active library to scan for vendor tabs.
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="New vendor tab name..."
          value={newTab}
          onChange={(e) => setNewTab(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newTab.trim()}
        >
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          No vendor tabs defined. Click "Scan Items" to discover from XML.
        </Typography>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Tab Name</TableCell>
                <TableCell sx={{ width: 80 }}>Count</TableCell>
                <TableCell>Used By</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name} hover>
                  <TableCell>
                    <Typography variant="body2">{row.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={row.count === null ? 'text.disabled' : 'text.primary'}
                    >
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map((name) => (
                          <Chip key={name} label={name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell padding="none">
                    <Tooltip
                      title={
                        row.count > 0
                          ? `In use by ${row.count} item${row.count !== 1 ? 's' : ''} — removing may break editors`
                          : ''
                      }
                    >
                      <IconButton
                        size="small"
                        color={row.count > 0 ? 'warning' : 'default'}
                        onClick={() => onChange(vendorTabs.filter((t) => t !== row.name))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

// ─── NPC Jobs Tab ──────────────────────────────────────────────────────────────

function NpcJobsTab({ npcJobs, onChange, activeLibrary, initialDetails, onIndexUpdated }) {
  const [newJob, setNewJob] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanData, setScanData] = useState(initialDetails || null)

  const handleAdd = () => {
    const val = newJob.trim()
    if (!val || npcJobs.includes(val)) return
    onChange([...npcJobs, val].sort())
    setNewJob('')
  }

  const handleScan = async () => {
    if (!activeLibrary) return
    setScanning(true)
    try {
      const details = await window.electronAPI.scanNpcJobs(activeLibrary)
      setScanData(details)
      const scannedNames = details.map((d) => d.name)
      const merged = [...new Set([...npcJobs, ...scannedNames])].sort()
      onChange(merged)
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary)
      if (updatedIndex) onIndexUpdated(updatedIndex)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const rows = useMemo(() => {
    const scanMap = {}
    if (scanData)
      scanData.forEach((r) => {
        scanMap[r.name] = r
      })
    return npcJobs.map((name) => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? []
    }))
  }, [npcJobs, scanData])

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            flex: 1
          }}>
          NPC job names derived from filename prefixes (e.g. <code>blacksmith</code> in{' '}
          <code>blacksmith_anvil.xml</code>).
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan}
          disabled={scanning || !activeLibrary}
        >
          Scan NPCs
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Set an active library to scan for NPC jobs.
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="New job name..."
          value={newJob}
          onChange={(e) => setNewJob(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newJob.trim()}
        >
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          No NPC jobs defined. Click "Scan NPCs" to discover from filenames.
        </Typography>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Job Name</TableCell>
                <TableCell sx={{ width: 80 }}>Count</TableCell>
                <TableCell>Used By</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name} hover>
                  <TableCell>
                    <Typography variant="body2">{row.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={row.count === null ? 'text.disabled' : 'text.primary'}
                    >
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map((name) => (
                          <Chip key={name} label={name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell padding="none">
                    <Tooltip
                      title={
                        row.count > 0
                          ? `In use by ${row.count} NPC${row.count !== 1 ? 's' : ''} — removing may break editors`
                          : ''
                      }
                    >
                      <IconButton
                        size="small"
                        color={row.count > 0 ? 'warning' : 'default'}
                        onClick={() => onChange(npcJobs.filter((j) => j !== row.name))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

// ─── Creature Families Tab ─────────────────────────────────────────────────────

function CreatureFamiliesTab({
  creatureFamilies,
  onChange,
  activeLibrary,
  initialDetails,
  onIndexUpdated
}) {
  const [newFamily, setNewFamily] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanData, setScanData] = useState(initialDetails || null)

  const handleAdd = () => {
    const val = newFamily.trim()
    if (!val || creatureFamilies.includes(val)) return
    onChange([...creatureFamilies, val].sort())
    setNewFamily('')
  }

  const handleScan = async () => {
    if (!activeLibrary) return
    setScanning(true)
    try {
      const details = await window.electronAPI.scanCreatureFamilies(activeLibrary)
      setScanData(details)
      const scannedNames = details.map((d) => d.name)
      const merged = [...new Set([...creatureFamilies, ...scannedNames])].sort()
      onChange(merged)
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary)
      if (updatedIndex) onIndexUpdated(updatedIndex)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const rows = useMemo(() => {
    const scanMap = {}
    if (scanData)
      scanData.forEach((r) => {
        scanMap[r.name] = r
      })
    return creatureFamilies.map((name) => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? []
    }))
  }, [creatureFamilies, scanData])

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            flex: 1
          }}>
          Creature family names derived from filename prefixes (e.g. <code>goblin</code> in{' '}
          <code>goblin_shaman.xml</code>).
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan}
          disabled={scanning || !activeLibrary}
        >
          Scan Creatures
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Set an active library to scan for creature families.
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="New family name..."
          value={newFamily}
          onChange={(e) => setNewFamily(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newFamily.trim()}
        >
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          No creature families defined. Click "Scan Creatures" to discover from filenames.
        </Typography>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Family Name</TableCell>
                <TableCell sx={{ width: 80 }}>Count</TableCell>
                <TableCell>Used By</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name} hover>
                  <TableCell>
                    <Typography variant="body2">{row.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={row.count === null ? 'text.disabled' : 'text.primary'}
                    >
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map((name) => (
                          <Chip key={name} label={name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell padding="none">
                    <Tooltip
                      title={
                        row.count > 0
                          ? `In use by ${row.count} creature${row.count !== 1 ? 's' : ''} — removing may break editors`
                          : ''
                      }
                    >
                      <IconButton
                        size="small"
                        color={row.count > 0 ? 'warning' : 'default'}
                        onClick={() => onChange(creatureFamilies.filter((f) => f !== row.name))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

// ─── Category Tab (reused for Item / Castable / Status) ────────────────────────

function CategoryTab({
  label,
  scanResultKey,
  categories,
  onChange,
  activeLibrary,
  onIndexUpdated,
  initialDetails
}) {
  const [scanning, setScanning] = useState(false)
  const [scanData, setScanData] = useState(initialDetails || null)
  const [newCat, setNewCat] = useState('')

  const handleScan = async () => {
    if (!activeLibrary) return
    setScanning(true)
    try {
      const result = await window.electronAPI.scanCategories(activeLibrary)
      const scanned = result[scanResultKey] || []
      setScanData(scanned)
      const scannedNames = scanned.map((c) => c.name)
      const merged = [...new Set([...categories, ...scannedNames])].sort()
      onChange(merged)
      // Reload index so other editors see updated category lists
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary)
      if (updatedIndex) onIndexUpdated(updatedIndex)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const handleAdd = () => {
    const val = newCat.trim()
    if (!val || categories.includes(val)) return
    onChange([...categories, val].sort())
    setNewCat('')
  }

  const handleDelete = (cat) => {
    onChange(categories.filter((c) => c !== cat))
  }

  // Build display rows: join category list with scan data (for count/usedBy)
  const rows = useMemo(() => {
    const scanMap = {}
    if (scanData)
      scanData.forEach((r) => {
        scanMap[r.name] = r
      })
    return categories.map((name) => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? []
    }))
  }, [categories, scanData])

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            flex: 1
          }}>
          {label} defined in this library.
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan}
          disabled={scanning || !activeLibrary}
        >
          Scan XML
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Set an active library to scan for categories.
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Add category..."
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newCat.trim()}
        >
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          No categories defined. Click "Scan XML" to discover from files.
        </Typography>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Category Name</TableCell>
                <TableCell sx={{ width: 80 }}>Count</TableCell>
                <TableCell>Used By</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name} hover>
                  <TableCell>
                    <Typography variant="body2">{row.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={row.count === null ? 'text.disabled' : 'text.primary'}
                    >
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map((name) => (
                          <Chip key={name} label={name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell padding="none">
                    <IconButton size="small" onClick={() => handleDelete(row.name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

// ─── Cookies Tab ───────────────────────────────────────────────────────────────

function CookiesTab({ userConstants, onChange, activeLibrary }) {
  const [scanning, setScanning] = useState(false)
  const [newCookieName, setNewCookieName] = useState('')

  const cookies = userConstants.cookies || []

  const handleScan = async () => {
    if (!activeLibrary) return
    setScanning(true)
    try {
      const scanned = await window.electronAPI.scanCookies(activeLibrary)
      const commentMap = {}
      cookies.forEach((c) => {
        commentMap[c.name] = c.comment || ''
      })
      const merged = scanned.map((c) => ({
        name: c.name,
        sourceFile: c.sourceFile,
        comment: commentMap[c.name] || ''
      }))
      const scannedNames = new Set(scanned.map((c) => c.name))
      for (const c of cookies) {
        if (!scannedNames.has(c.name)) {
          merged.push({ name: c.name, sourceFile: c.sourceFile || '', comment: c.comment || '' })
        }
      }
      merged.sort((a, b) => a.name.localeCompare(b.name))
      onChange({ ...userConstants, cookies: merged })
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const handleUpdateComment = (name, comment) => {
    onChange({
      ...userConstants,
      cookies: cookies.map((c) => (c.name === name ? { ...c, comment } : c))
    })
  }

  const handleDelete = (name) => {
    onChange({ ...userConstants, cookies: cookies.filter((c) => c.name !== name) })
  }

  const handleAdd = () => {
    const name = newCookieName.trim()
    if (!name || cookies.some((c) => c.name === name)) return
    const updated = [...cookies, { name, sourceFile: '', comment: '' }].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    onChange({ ...userConstants, cookies: updated })
    setNewCookieName('')
  }

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            flex: 1
          }}>
          Cookies set by Lua scripts. Scan to auto-discover, or add manually.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan}
          disabled={scanning || !activeLibrary}
        >
          Scan Scripts
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Set an active library to scan for cookies.
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Cookie name..."
          value={newCookieName}
          onChange={(e) => setNewCookieName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newCookieName.trim()}
        >
          Add
        </Button>
      </Box>
      {cookies.length === 0 ? (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          No cookies defined. Click "Scan Scripts" to discover cookies from Lua scripts.
        </Typography>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 240 }}>Cookie Name</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {cookies.map((cookie) => (
                <TableRow key={cookie.name} hover>
                  <TableCell>
                    <Typography variant="body2">{cookie.name}</Typography>
                    {cookie.sourceFile && (
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          color: "text.secondary",
                          display: "block"
                        }}>
                        {cookie.sourceFile}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      placeholder="Add a comment..."
                      value={cookie.comment || ''}
                      onChange={(e) => handleUpdateComment(cookie.name, e.target.value)}
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell padding="none">
                    <IconButton size="small" onClick={() => handleDelete(cookie.name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

// ─── Motions Tab ───────────────────────────────────────────────────────────────

const DEFAULT_MOTIONS = [
  { name: 'Basic - Assail', id: 1, speed: 20 },
  { name: 'Basic - Cast', id: 6, speed: 40 },
  { name: 'Priest - Cast', id: 128, speed: 20 },
  { name: 'Warrior - 2h Attack', id: 129, speed: 20 },
  { name: 'Warrior - Charge', id: 130, speed: 20 },
  { name: 'Monk - Kick', id: 131, speed: 20 },
  { name: 'Monk - Punch', id: 132, speed: 20 },
  { name: 'Monk - Kick 2', id: 133, speed: 20 },
  { name: 'Rogue - Stab Once', id: 134, speed: 40 },
  { name: 'Rogue - Stab Twice', id: 135, speed: 40 },
  { name: 'Wizard - Cast', id: 136, speed: 20 },
  { name: 'Bard - Sing', id: 137, speed: 20 },
  { name: 'Bard - Attack', id: 138, speed: 20 },
  { name: 'Gladiator - Swipe', id: 139, speed: 20 },
  { name: 'Gladiator - Sweep', id: 140, speed: 20 },
  { name: 'Gladiator - Hop', id: 141, speed: 20 },
  { name: 'Archer - Shoot', id: 142, speed: 20 },
  { name: 'Archer - Long Shoot', id: 143, speed: 20 },
  { name: 'Archer - Far Shoot', id: 144, speed: 20 },
  { name: 'Summoner - Cast', id: 145, speed: 40 }
]

function MotionsTab({ userConstants, onChange }) {
  const motions = userConstants.motions || []
  const [newName, setNewName] = useState('')
  const [newId, setNewId] = useState('')
  const [newSpeed, setNewSpeed] = useState('')

  const handleUpdate = (index, field, value) => {
    const updated = motions.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    onChange({ ...userConstants, motions: updated })
  }

  const handleDelete = (index) => {
    onChange({ ...userConstants, motions: motions.filter((_, i) => i !== index) })
  }

  const handleAdd = () => {
    const name = newName.trim()
    const id = Number(newId)
    const speed = Number(newSpeed)
    if (!name || !newId) return
    onChange({ ...userConstants, motions: [...motions, { name, id, speed: speed || 20 }] })
    setNewName('')
    setNewId('')
    setNewSpeed('')
  }

  const handleReset = () => {
    onChange({ ...userConstants, motions: DEFAULT_MOTIONS.map((m) => ({ ...m })) })
  }

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            flex: 1
          }}>
          Player motion IDs and speeds used by the animation preset buttons in the castable editor.
        </Typography>
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={handleReset}>
          Reset to defaults
        </Button>
      </Box>
      {motions.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Alert severity="info" sx={{ flex: 1 }}>
            No motions defined. Load the defaults or add entries manually.
          </Alert>
          <Button size="small" variant="contained" onClick={handleReset}>
            Load defaults
          </Button>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ width: 110 }}>Motion ID</TableCell>
                <TableCell sx={{ width: 110 }}>Speed</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {motions.map((motion, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      value={motion.name || ''}
                      onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      value={motion.id ?? ''}
                      onChange={(e) =>
                        handleUpdate(index, 'id', Number(e.target.value.replace(/\D/g, '')))
                      }
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                      slotProps={{
                        htmlInput: { inputMode: 'numeric' }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      value={motion.speed ?? ''}
                      onChange={(e) =>
                        handleUpdate(index, 'speed', Number(e.target.value.replace(/\D/g, '')))
                      }
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                      slotProps={{
                        htmlInput: { inputMode: 'numeric' }
                      }}
                    />
                  </TableCell>
                  <TableCell padding="none">
                    <IconButton size="small" onClick={() => handleDelete(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ flex: 1, maxWidth: 300 }}
        />
        <TextField
          size="small"
          placeholder="ID..."
          value={newId}
          onChange={(e) => setNewId(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ width: 90 }}
          slotProps={{
            htmlInput: { inputMode: 'numeric' }
          }}
        />
        <TextField
          size="small"
          placeholder="Speed..."
          value={newSpeed}
          onChange={(e) => setNewSpeed(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ width: 90 }}
          slotProps={{
            htmlInput: { inputMode: 'numeric' }
          }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newName.trim() || !newId}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}

// ─── Weapons Tab ───────────────────────────────────────────────────────────────
//
// Weapon presets used by the creature editor. A weapon entry is a name plus
// min/max damage values; selecting one in the creature editor prepopulates
// the creature's Min/Max Damage fields. Only the damage values are saved
// to XML — the weapon name is a UI hint, not persisted on the creature.

function WeaponsTab({ userConstants, onChange }) {
  const weapons = userConstants.weapons || []
  const [newName, setNewName] = useState('')
  const [newMin, setNewMin] = useState('')
  const [newMax, setNewMax] = useState('')

  const handleUpdate = (index, field, value) => {
    const updated = weapons.map((w, i) => (i === index ? { ...w, [field]: value } : w))
    onChange({ ...userConstants, weapons: updated })
  }

  const handleDelete = (index) => {
    onChange({ ...userConstants, weapons: weapons.filter((_, i) => i !== index) })
  }

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    onChange({
      ...userConstants,
      weapons: [...weapons, { name, minDmg: newMin.trim(), maxDmg: newMax.trim() }]
    })
    setNewName('')
    setNewMin('')
    setNewMax('')
  }

  return (
    <Box
      sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Weapon presets used by the creature editor. Picking a weapon prepopulates
          Min/Max Damage; only the damage values are saved to XML, so the weapon
          name and Min/Max here are author-facing references.
        </Typography>
      </Box>
      {weapons.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No weapons defined. Add entries below.
        </Alert>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ width: 130 }}>Min Damage</TableCell>
                <TableCell sx={{ width: 130 }}>Max Damage</TableCell>
                <TableCell sx={{ width: 40 }} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {weapons.map((weapon, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      value={weapon.name || ''}
                      onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      value={weapon.minDmg ?? ''}
                      onChange={(e) => handleUpdate(index, 'minDmg', e.target.value)}
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      variant="standard"
                      value={weapon.maxDmg ?? ''}
                      onChange={(e) => handleUpdate(index, 'maxDmg', e.target.value)}
                      sx={{
                        '& .MuiInput-root::before': { borderBottom: 'none' },
                        '& input': { fontSize: '0.875rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell padding="none">
                    <IconButton size="small" onClick={() => handleDelete(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ flex: 1, maxWidth: 300 }}
        />
        <TextField
          size="small"
          placeholder="Min..."
          value={newMin}
          onChange={(e) => setNewMin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ width: 100 }}
        />
        <TextField
          size="small"
          placeholder="Max..."
          value={newMax}
          onChange={(e) => setNewMax(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          sx={{ width: 100 }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          Add
        </Button>
      </Box>
    </Box>
  )
}

// ─── Spell Books Tab ───────────────────────────────────────────────────────────
//
// A "spell book" is a named collection of castables. Saving the book writes
// the list to constants.json AND adds the book's name as a category onto
// each selected castable (so BehaviorSets can reference the category).
//
// UI: left panel lists existing books; right panel edits the active book
// with a dual-list picker (Available ↔ In book) and > / >> / < / << buttons.

function SpellBooksTab({ spellBooks, onChange, activeLibrary, libraryIndex, onIndexUpdated }) {
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [draft, setDraft] = useState({ name: '', castables: [] })
  const [leftSel, setLeftSel] = useState(new Set())
  const [rightSel, setRightSel] = useState(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState(null)

  const selectedBook = useMemo(
    () => (selectedBookId ? (spellBooks || []).find((b) => b.id === selectedBookId) : null),
    [selectedBookId, spellBooks]
  )

  // Sync draft when switching books
  useEffect(() => {
    if (selectedBook) {
      setDraft({ name: selectedBook.name || '', castables: [...(selectedBook.castables || [])] })
    } else {
      setDraft({ name: '', castables: [] })
    }
    setLeftSel(new Set())
    setRightSel(new Set())
  }, [selectedBookId, selectedBook])

  const allCastables = libraryIndex?.castables || []
  const available = useMemo(() => {
    const inBook = new Set(draft.castables)
    const q = search.trim().toLowerCase()
    return allCastables.filter((n) => !inBook.has(n) && (!q || n.toLowerCase().includes(q)))
  }, [allCastables, draft.castables, search])

  const handleNew = () => {
    const id = crypto.randomUUID()
    const next = [...(spellBooks || []), { id, name: 'New Spell Book', castables: [] }]
    onChange(next)
    setSelectedBookId(id)
  }

  const handleDelete = () => {
    if (!selectedBookId) return
    onChange((spellBooks || []).filter((b) => b.id !== selectedBookId))
    setSelectedBookId(null)
  }

  const commitDraft = (partial) => {
    if (!selectedBookId) return
    const merged = { ...draft, ...partial }
    setDraft(merged)
    onChange((spellBooks || []).map((b) => (b.id === selectedBookId ? { ...b, ...merged } : b)))
  }

  const moveRight = (all = false) => {
    const moving = all ? available : available.filter((n) => leftSel.has(n))
    if (!moving.length) return
    commitDraft({ castables: [...draft.castables, ...moving].sort() })
    setLeftSel(new Set())
  }

  const moveLeft = (all = false) => {
    const keep = all ? [] : draft.castables.filter((n) => !rightSel.has(n))
    commitDraft({ castables: keep })
    setRightSel(new Set())
  }

  const toggleSel = (setSel, value) => (event) => {
    setSel((prev) => {
      const next = new Set(prev)
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        if (next.has(value)) next.delete(value)
        else next.add(value)
      } else {
        next.clear()
        next.add(value)
      }
      return next
    })
  }

  const handleSaveAndApply = async () => {
    if (!selectedBookId || !activeLibrary || !draft.name.trim()) return
    setSaving(true)
    try {
      const result = await window.electronAPI.castableAddCategoryBulk(
        activeLibrary,
        draft.castables,
        draft.name.trim()
      )
      const { updated = [], unchanged = [], failed = [] } = result || {}
      const msg = `${updated.length} updated, ${unchanged.length} already had category, ${failed.length} failed.`
      setSnackbar({ message: msg, severity: failed.length ? 'warning' : 'success' })
      // Request a castables section re-index so libraryIndex picks up the new category
      if (updated.length) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, 'castables')
        onIndexUpdated?.(section)
      }
    } catch (err) {
      setSnackbar({ message: `Save failed: ${err?.message || err}`, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Left: list of books */}
      <Box
        sx={{
          width: 220,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Spell Books
          </Typography>
          <Tooltip title="New spell book">
            <IconButton size="small" onClick={handleNew}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
          {(spellBooks || []).map((book) => (
            <ListItem key={book.id} disablePadding>
              <ListItemButton
                selected={book.id === selectedBookId}
                onClick={() => setSelectedBookId(book.id)}
              >
                <ListItemText
                  primary={book.name || '(unnamed)'}
                  secondary={`${(book.castables || []).length} castables`}
                  slotProps={{
                    primary: { variant: 'body2', noWrap: true },
                    secondary: { variant: 'caption' }
                  }} />
              </ListItemButton>
            </ListItem>
          ))}
          {(spellBooks || []).length === 0 && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                p: 2
              }}>
              No spell books yet.
            </Typography>
          )}
        </List>
      </Box>
      {/* Right: editor */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          overflow: 'hidden',
          minWidth: 0
        }}
      >
        {!selectedBook ? (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Select a spell book or create a new one.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                label="Name"
                sx={{ flex: 1, maxWidth: 360 }}
                value={draft.name}
                onChange={(e) => commitDraft({ name: e.target.value })}
              />
              <Tooltip title="Delete spell book">
                <IconButton size="small" onClick={handleDelete}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', gap: 1, minHeight: 0 }}>
              {/* Available */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  Available ({available.length})
                </Typography>
                <TextField
                  size="small"
                  placeholder="Filter…"
                  sx={{ mb: 0.5 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }
                  }}
                />
                <Box
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                >
                  <List dense disablePadding>
                    {available.map((n) => (
                      <ListItemButton
                        key={n}
                        selected={leftSel.has(n)}
                        onClick={toggleSel(setLeftSel, n)}
                        onDoubleClick={() => {
                          commitDraft({ castables: [...draft.castables, n].sort() })
                        }}
                      >
                        <ListItemText
                          primary={n}
                          slotProps={{
                            primary: { variant: 'body2', noWrap: true }
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              </Box>

              {/* Move buttons */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 0.5
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => moveRight(false)}
                  disabled={leftSel.size === 0}
                >
                  &gt;
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => moveRight(true)}
                  disabled={available.length === 0}
                >
                  &gt;&gt;
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => moveLeft(false)}
                  disabled={rightSel.size === 0}
                >
                  &lt;
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => moveLeft(true)}
                  disabled={draft.castables.length === 0}
                >
                  &lt;&lt;
                </Button>
              </Box>

              {/* In book */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  In spell book ({draft.castables.length})
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mt: '22px' /* align with left col */
                  }}
                >
                  <List dense disablePadding>
                    {draft.castables.map((n) => (
                      <ListItemButton
                        key={n}
                        selected={rightSel.has(n)}
                        onClick={toggleSel(setRightSel, n)}
                        onDoubleClick={() =>
                          commitDraft({ castables: draft.castables.filter((x) => x !== n) })
                        }
                      >
                        <ListItemText
                          primary={n}
                          slotProps={{
                            primary: { variant: 'body2', noWrap: true }
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={handleSaveAndApply}
                disabled={
                  saving || !draft.name.trim() || draft.castables.length === 0 || !activeLibrary
                }
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
              >
                {saving ? 'Applying…' : 'Save & apply category to castables'}
              </Button>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                Writes "{draft.name.trim() || '…'}" as a category onto {draft.castables.length}{' '}
                castable XML file{draft.castables.length === 1 ? '' : 's'}.
              </Typography>
            </Box>
          </>
        )}
      </Box>
      {snackbar && (
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(null)}
          sx={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}
        >
          {snackbar.message}
        </Alert>
      )}
    </Box>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Simple Types' },
  { label: 'Vendor Tabs' },
  { label: 'NPC Jobs' },
  { label: 'Creature Families' },
  { label: 'Item Categories' },
  { label: 'Castable Categories' },
  { label: 'Status Categories' },
  { label: 'Cookies' },
  { label: 'Motions' },
  { label: 'Weapons' },
  { label: 'Spell Books' }
]

function ConstantsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState)
  const [tab, setTab] = useState(0)
  const [userConstants, setUserConstants] = useState(EMPTY_CONSTANTS)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { markDirty, markClean, saveRef } = useUnsavedGuard('Constants')
  const handleSaveRef = useRef(null)

  // Keep saveRef pointed at the current save function
  useEffect(() => {
    saveRef.current = () => handleSaveRef.current?.()
  })

  useEffect(() => {
    window.electronAPI
      .loadUserConstants(activeLibrary)
      .then((data) => setUserConstants({ ...EMPTY_CONSTANTS, ...data }))
      .catch(console.error)
    setDirty(false)
    markClean()
  }, [activeLibrary, markClean])

  const handleChange = useCallback(
    (newConstants) => {
      setUserConstants(newConstants)
      setDirty(true)
      markDirty()
    },
    [markDirty]
  )

  const handleCategoryChange = useCallback(
    (key, names) => {
      setUserConstants((prev) => {
        const next = { ...prev, [key]: names }
        setDirty(true)
        markDirty()
        return next
      })
    },
    [markDirty]
  )

  // After any scan that writes to the index, reload it and merge with current user constants
  const handleIndexUpdated = useCallback(
    (rawIndex) => {
      if (!rawIndex) return
      const dedup = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort()
      setLibraryIndex({
        ...rawIndex,
        vendorTabs: dedup(rawIndex.vendorTabs, userConstants.vendorTabs),
        npcJobs: dedup(rawIndex.npcJobs, userConstants.npcJobs),
        creatureFamilies: dedup(rawIndex.creatureFamilies, userConstants.creatureFamilies),
        itemCategories: dedup(rawIndex.itemCategories, userConstants.itemCategories),
        castableCategories: dedup(rawIndex.castableCategories, userConstants.castableCategories),
        statusCategories: dedup(rawIndex.statusCategories, userConstants.statusCategories),
        cookieNames: dedup(
          rawIndex.cookieNames,
          (userConstants.cookies || []).map((c) => c.name)
        ),
        motions: userConstants.motions || [],
        weapons: userConstants.weapons || []
      })
    },
    [setLibraryIndex, userConstants]
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.electronAPI.saveUserConstants(activeLibrary, userConstants)
      const dedup = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort()
      setLibraryIndex((prev) => ({
        ...prev,
        vendorTabs: dedup(prev.vendorTabs, userConstants.vendorTabs),
        npcJobs: dedup(prev.npcJobs, userConstants.npcJobs),
        creatureFamilies: dedup(prev.creatureFamilies, userConstants.creatureFamilies),
        itemCategories: dedup(prev.itemCategories, userConstants.itemCategories),
        castableCategories: dedup(prev.castableCategories, userConstants.castableCategories),
        statusCategories: dedup(prev.statusCategories, userConstants.statusCategories),
        cookieNames: dedup(
          prev.cookieNames,
          (userConstants.cookies || []).map((c) => c.name)
        ),
        motions: userConstants.motions || [],
        weapons: userConstants.weapons || []
      }))
      setDirty(false)
      markClean()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [activeLibrary, userConstants, setLibraryIndex, markClean])

  // Keep the stable ref in sync for saveRef
  useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: "bold",
            flex: 1
          }}>
          Constants
        </Typography>
        {dirty && (
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save
          </Button>
        )}
      </Box>
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          {TABS.map((t) => (
            <Tab key={t.label} label={t.label} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {tab === 0 && <SimpleTypesTab />}
        {tab === 1 && (
          <VendorTabsTab
            vendorTabs={userConstants.vendorTabs || []}
            onChange={(tabs) => handleCategoryChange('vendorTabs', tabs)}
            activeLibrary={activeLibrary}
            initialDetails={libraryIndex.vendorTabDetails}
            onIndexUpdated={handleIndexUpdated}
          />
        )}
        {tab === 2 && (
          <NpcJobsTab
            npcJobs={userConstants.npcJobs || []}
            onChange={(jobs) => handleCategoryChange('npcJobs', jobs)}
            activeLibrary={activeLibrary}
            initialDetails={libraryIndex.npcJobDetails}
            onIndexUpdated={handleIndexUpdated}
          />
        )}
        {tab === 3 && (
          <CreatureFamiliesTab
            creatureFamilies={userConstants.creatureFamilies || []}
            onChange={(families) => handleCategoryChange('creatureFamilies', families)}
            activeLibrary={activeLibrary}
            initialDetails={libraryIndex.creatureFamilyDetails}
            onIndexUpdated={handleIndexUpdated}
          />
        )}
        {tab === 4 && (
          <CategoryTab
            label="Item categories"
            scanResultKey="items"
            categories={userConstants.itemCategories || []}
            onChange={(names) => handleCategoryChange('itemCategories', names)}
            activeLibrary={activeLibrary}
            onIndexUpdated={handleIndexUpdated}
            initialDetails={libraryIndex.itemCategoryDetails}
          />
        )}
        {tab === 5 && (
          <CategoryTab
            label="Castable categories"
            scanResultKey="castables"
            categories={userConstants.castableCategories || []}
            onChange={(names) => handleCategoryChange('castableCategories', names)}
            activeLibrary={activeLibrary}
            onIndexUpdated={handleIndexUpdated}
            initialDetails={libraryIndex.castableCategoryDetails}
          />
        )}
        {tab === 6 && (
          <CategoryTab
            label="Status categories"
            scanResultKey="statuses"
            categories={userConstants.statusCategories || []}
            onChange={(names) => handleCategoryChange('statusCategories', names)}
            activeLibrary={activeLibrary}
            onIndexUpdated={handleIndexUpdated}
            initialDetails={libraryIndex.statusCategoryDetails}
          />
        )}
        {tab === 7 && (
          <CookiesTab
            userConstants={userConstants}
            onChange={handleChange}
            activeLibrary={activeLibrary}
          />
        )}
        {tab === 8 && <MotionsTab userConstants={userConstants} onChange={handleChange} />}
        {tab === 9 && <WeaponsTab userConstants={userConstants} onChange={handleChange} />}
        {tab === 10 && (
          <SpellBooksTab
            spellBooks={userConstants.spellBooks || []}
            onChange={(books) => handleChange({ ...userConstants, spellBooks: books })}
            activeLibrary={activeLibrary}
            libraryIndex={libraryIndex}
            onIndexUpdated={handleIndexUpdated}
          />
        )}
      </Box>
    </Box>
  );
}

export default ConstantsPage
