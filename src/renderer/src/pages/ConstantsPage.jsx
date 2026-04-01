import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Tabs, Tab, Divider, List, ListItem, ListItemText,
  ListItemButton, TextField, IconButton, Tooltip, Button, Chip,
  Table, TableBody, TableCell, TableHead, TableRow,
  InputAdornment, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRecoilValue, useRecoilState } from 'recoil';
import { activeLibraryState, libraryIndexState } from '../recoil/atoms';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';

const EMPTY_CONSTANTS = {
  vendorTabs: [],
  itemCategories: [],
  castableCategories: [],
  statusCategories: [],
  cookies: [],
  npcJobs: [],
};

// ─── Simple Types Tab ──────────────────────────────────────────────────────────

function SimpleTypesTab() {
  const [xsdTypes, setXsdTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    window.electronAPI.loadXsdTypes()
      .then(types => { setXsdTypes(types); if (types.length) setSelected(types[0]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? xsdTypes.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : xsdTypes;

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: type list */}
      <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 1 }}>
          <TextField
            size="small" fullWidth placeholder="Filter types..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
        ) : (
          <List dense disablePadding sx={{ flex: 1, overflow: 'auto' }}>
            {filtered.map(type => (
              <ListItem key={type.name} disablePadding>
                <ListItemButton selected={selected?.name === type.name} onClick={() => setSelected(type)}>
                  <ListItemText
                    primary={type.name}
                    secondary={type.sourceFile}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                    secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {filtered.length === 0 && !loading && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No matches.</Typography>
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
              {selected.isList && <Chip size="small" label="flags list" color="info" variant="outlined" />}
              <Chip size="small" label={selected.sourceFile} variant="outlined" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
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
                  {selected.values.map(v => (
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
            <Typography color="text.secondary">Select a type to view its values.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Vendor Tabs Tab ───────────────────────────────────────────────────────────

function VendorTabsTab({ vendorTabs, onChange, activeLibrary, initialDetails, onIndexUpdated }) {
  const [newTab, setNewTab] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanData, setScanData] = useState(initialDetails || null);

  const handleAdd = () => {
    const val = newTab.trim();
    if (!val || vendorTabs.includes(val)) return;
    onChange([...vendorTabs, val].sort());
    setNewTab('');
  };

  const handleScan = async () => {
    if (!activeLibrary) return;
    setScanning(true);
    try {
      const details = await window.electronAPI.scanVendorTabs(activeLibrary);
      setScanData(details);
      const scannedNames = details.map(d => d.name);
      const merged = [...new Set([...vendorTabs, ...scannedNames])].sort();
      onChange(merged);
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary);
      if (updatedIndex) onIndexUpdated(updatedIndex);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const rows = useMemo(() => {
    const scanMap = {};
    if (scanData) scanData.forEach(r => { scanMap[r.name] = r; });
    return vendorTabs.map(name => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? [],
    }));
  }, [vendorTabs, scanData]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Vendor tab names used on item definitions (<code>Vendor/@ShopTab</code>).
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small" variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan} disabled={scanning || !activeLibrary}
        >
          Scan Items
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>Set an active library to scan for vendor tabs.</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" placeholder="New vendor tab name..." value={newTab}
          onChange={e => setNewTab(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={!newTab.trim()}>
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
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
              {rows.map(row => (
                <TableRow key={row.name} hover>
                  <TableCell><Typography variant="body2">{row.name}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" color={row.count === null ? 'text.disabled' : 'text.primary'}>
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map(name => (
                          <Chip key={name} label={name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell padding="none">
                    <Tooltip title={row.count > 0 ? `In use by ${row.count} item${row.count !== 1 ? 's' : ''} — removing may break editors` : ''}>
                      <IconButton
                        size="small"
                        color={row.count > 0 ? 'warning' : 'default'}
                        onClick={() => onChange(vendorTabs.filter(t => t !== row.name))}
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
  const [newJob, setNewJob] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanData, setScanData] = useState(initialDetails || null);

  const handleAdd = () => {
    const val = newJob.trim();
    if (!val || npcJobs.includes(val)) return;
    onChange([...npcJobs, val].sort());
    setNewJob('');
  };

  const handleScan = async () => {
    if (!activeLibrary) return;
    setScanning(true);
    try {
      const details = await window.electronAPI.scanNpcJobs(activeLibrary);
      setScanData(details);
      const scannedNames = details.map(d => d.name);
      const merged = [...new Set([...npcJobs, ...scannedNames])].sort();
      onChange(merged);
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary);
      if (updatedIndex) onIndexUpdated(updatedIndex);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const rows = useMemo(() => {
    const scanMap = {};
    if (scanData) scanData.forEach(r => { scanMap[r.name] = r; });
    return npcJobs.map(name => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? [],
    }));
  }, [npcJobs, scanData]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          NPC job names derived from filename prefixes (e.g. <code>blacksmith</code> in <code>blacksmith_anvil.xml</code>).
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small" variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan} disabled={scanning || !activeLibrary}
        >
          Scan NPCs
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>Set an active library to scan for NPC jobs.</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" placeholder="New job name..." value={newJob}
          onChange={e => setNewJob(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={!newJob.trim()}>
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
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
              {rows.map(row => (
                <TableRow key={row.name} hover>
                  <TableCell><Typography variant="body2">{row.name}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" color={row.count === null ? 'text.disabled' : 'text.primary'}>
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map(name => (
                          <Chip key={name} label={name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell padding="none">
                    <Tooltip title={row.count > 0 ? `In use by ${row.count} NPC${row.count !== 1 ? 's' : ''} — removing may break editors` : ''}>
                      <IconButton
                        size="small"
                        color={row.count > 0 ? 'warning' : 'default'}
                        onClick={() => onChange(npcJobs.filter(j => j !== row.name))}
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

function CategoryTab({ label, scanResultKey, categories, onChange, activeLibrary, onIndexUpdated, initialDetails }) {
  const [scanning, setScanning] = useState(false);
  const [scanData, setScanData] = useState(initialDetails || null);
  const [newCat, setNewCat] = useState('');

  const handleScan = async () => {
    if (!activeLibrary) return;
    setScanning(true);
    try {
      const result = await window.electronAPI.scanCategories(activeLibrary);
      const scanned = result[scanResultKey] || [];
      setScanData(scanned);
      const scannedNames = scanned.map(c => c.name);
      const merged = [...new Set([...categories, ...scannedNames])].sort();
      onChange(merged);
      // Reload index so other editors see updated category lists
      const updatedIndex = await window.electronAPI.loadIndex(activeLibrary);
      if (updatedIndex) onIndexUpdated(updatedIndex);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = () => {
    const val = newCat.trim();
    if (!val || categories.includes(val)) return;
    onChange([...categories, val].sort());
    setNewCat('');
  };

  const handleDelete = (cat) => {
    onChange(categories.filter(c => c !== cat));
  };

  // Build display rows: join category list with scan data (for count/usedBy)
  const rows = useMemo(() => {
    const scanMap = {};
    if (scanData) scanData.forEach(r => { scanMap[r.name] = r; });
    return categories.map(name => ({
      name,
      count: scanMap[name]?.count ?? (scanData ? 0 : null),
      usedBy: scanMap[name]?.usedBy ?? [],
    }));
  }, [categories, scanData]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {label} defined in this library.
          {scanData === null ? ' Scan to populate counts.' : ` ${scanData.length} found in XML.`}
        </Typography>
        <Button
          size="small" variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan} disabled={scanning || !activeLibrary}
        >
          Scan XML
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>Set an active library to scan for categories.</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" placeholder="Add category..." value={newCat}
          onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={!newCat.trim()}>
          Add
        </Button>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
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
              {rows.map(row => (
                <TableRow key={row.name} hover>
                  <TableCell><Typography variant="body2">{row.name}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" color={row.count === null ? 'text.disabled' : 'text.primary'}>
                      {row.count === null ? '—' : row.count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.usedBy.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.usedBy.map(name => (
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
  const [scanning, setScanning] = useState(false);
  const [newCookieName, setNewCookieName] = useState('');

  const cookies = userConstants.cookies || [];

  const handleScan = async () => {
    if (!activeLibrary) return;
    setScanning(true);
    try {
      const scanned = await window.electronAPI.scanCookies(activeLibrary);
      const commentMap = {};
      cookies.forEach(c => { commentMap[c.name] = c.comment || ''; });
      const merged = scanned.map(c => ({
        name: c.name,
        sourceFile: c.sourceFile,
        comment: commentMap[c.name] || '',
      }));
      const scannedNames = new Set(scanned.map(c => c.name));
      for (const c of cookies) {
        if (!scannedNames.has(c.name)) {
          merged.push({ name: c.name, sourceFile: c.sourceFile || '', comment: c.comment || '' });
        }
      }
      merged.sort((a, b) => a.name.localeCompare(b.name));
      onChange({ ...userConstants, cookies: merged });
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateComment = (name, comment) => {
    onChange({ ...userConstants, cookies: cookies.map(c => c.name === name ? { ...c, comment } : c) });
  };

  const handleDelete = (name) => {
    onChange({ ...userConstants, cookies: cookies.filter(c => c.name !== name) });
  };

  const handleAdd = () => {
    const name = newCookieName.trim();
    if (!name || cookies.some(c => c.name === name)) return;
    const updated = [...cookies, { name, sourceFile: '', comment: '' }]
      .sort((a, b) => a.name.localeCompare(b.name));
    onChange({ ...userConstants, cookies: updated });
    setNewCookieName('');
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Cookies set by Lua scripts. Scan to auto-discover, or add manually.
        </Typography>
        <Button
          size="small" variant="outlined"
          startIcon={scanning ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleScan} disabled={scanning || !activeLibrary}
        >
          Scan Scripts
        </Button>
      </Box>
      {!activeLibrary && (
        <Alert severity="info" sx={{ mb: 2 }}>Set an active library to scan for cookies.</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" placeholder="Cookie name..." value={newCookieName}
          onChange={e => setNewCookieName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{ maxWidth: 300 }}
        />
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={!newCookieName.trim()}>
          Add
        </Button>
      </Box>
      {cookies.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
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
              {cookies.map(cookie => (
                <TableRow key={cookie.name} hover>
                  <TableCell>
                    <Typography variant="body2">{cookie.name}</Typography>
                    {cookie.sourceFile && (
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {cookie.sourceFile}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" fullWidth variant="standard"
                      placeholder="Add a comment..."
                      value={cookie.comment || ''}
                      onChange={e => handleUpdateComment(cookie.name, e.target.value)}
                      sx={{ '& .MuiInput-root::before': { borderBottom: 'none' }, '& input': { fontSize: '0.875rem' } }}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Simple Types' },
  { label: 'Vendor Tabs' },
  { label: 'NPC Jobs' },
  { label: 'Item Categories' },
  { label: 'Castable Categories' },
  { label: 'Status Categories' },
  { label: 'Cookies' },
];

function ConstantsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState);
  const [tab, setTab] = useState(0);
  const [userConstants, setUserConstants] = useState(EMPTY_CONSTANTS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { markDirty, markClean, saveRef } = useUnsavedGuard('Constants');
  const handleSaveRef = useRef(null);

  // Keep saveRef pointed at the current save function
  useEffect(() => { saveRef.current = () => handleSaveRef.current?.(); });

  useEffect(() => {
    window.electronAPI.loadUserConstants(activeLibrary)
      .then(data => setUserConstants({ ...EMPTY_CONSTANTS, ...data }))
      .catch(console.error);
    setDirty(false);
    markClean();
  }, [activeLibrary, markClean]);

  const handleChange = useCallback((newConstants) => {
    setUserConstants(newConstants);
    setDirty(true);
    markDirty();
  }, [markDirty]);

  const handleCategoryChange = useCallback((key, names) => {
    setUserConstants(prev => {
      const next = { ...prev, [key]: names };
      setDirty(true);
      markDirty();
      return next;
    });
  }, [markDirty]);

  // After any scan that writes to the index, reload it and merge with current user constants
  const handleIndexUpdated = useCallback((rawIndex) => {
    if (!rawIndex) return;
    const dedup = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
    setLibraryIndex({
      ...rawIndex,
      vendorTabs:         dedup(rawIndex.vendorTabs,         userConstants.vendorTabs),
      npcJobs:            dedup(rawIndex.npcJobs,            userConstants.npcJobs),
      itemCategories:     dedup(rawIndex.itemCategories,     userConstants.itemCategories),
      castableCategories: dedup(rawIndex.castableCategories, userConstants.castableCategories),
      statusCategories:   dedup(rawIndex.statusCategories,   userConstants.statusCategories),
      cookieNames:        dedup(rawIndex.cookieNames,        (userConstants.cookies || []).map(c => c.name)),
    });
  }, [setLibraryIndex, userConstants]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveUserConstants(activeLibrary, userConstants);
      const dedup = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
      setLibraryIndex((prev) => ({
        ...prev,
        vendorTabs:         dedup(prev.vendorTabs,         userConstants.vendorTabs),
        npcJobs:            dedup(prev.npcJobs,            userConstants.npcJobs),
        itemCategories:     dedup(prev.itemCategories,     userConstants.itemCategories),
        castableCategories: dedup(prev.castableCategories, userConstants.castableCategories),
        statusCategories:   dedup(prev.statusCategories,   userConstants.statusCategories),
        cookieNames:        dedup(prev.cookieNames,        (userConstants.cookies || []).map(c => c.name)),
      }));
      setDirty(false);
      markClean();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [activeLibrary, userConstants, setLibraryIndex, markClean]);

  // Keep the stable ref in sync for saveRef
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>Constants</Typography>
        {dirty && (
          <Button
            size="small" variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save
          </Button>
        )}
      </Box>
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          {TABS.map(t => <Tab key={t.label} label={t.label} />)}
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {tab === 0 && <SimpleTypesTab />}
        {tab === 1 && (
          <VendorTabsTab
            vendorTabs={userConstants.vendorTabs || []}
            onChange={tabs => handleCategoryChange('vendorTabs', tabs)}
            activeLibrary={activeLibrary}
            initialDetails={libraryIndex.vendorTabDetails}
            onIndexUpdated={handleIndexUpdated}
          />
        )}
        {tab === 2 && (
          <NpcJobsTab
            npcJobs={userConstants.npcJobs || []}
            onChange={jobs => handleCategoryChange('npcJobs', jobs)}
            activeLibrary={activeLibrary}
            initialDetails={libraryIndex.npcJobDetails}
            onIndexUpdated={handleIndexUpdated}
          />
        )}
        {tab === 3 && (
          <CategoryTab
            label="Item categories"
            scanResultKey="items"
            categories={userConstants.itemCategories || []}
            onChange={names => handleCategoryChange('itemCategories', names)}
            activeLibrary={activeLibrary}
            onIndexUpdated={handleIndexUpdated}
            initialDetails={libraryIndex.itemCategoryDetails}
          />
        )}
        {tab === 4 && (
          <CategoryTab
            label="Castable categories"
            scanResultKey="castables"
            categories={userConstants.castableCategories || []}
            onChange={names => handleCategoryChange('castableCategories', names)}
            activeLibrary={activeLibrary}
            onIndexUpdated={handleIndexUpdated}
            initialDetails={libraryIndex.castableCategoryDetails}
          />
        )}
        {tab === 5 && (
          <CategoryTab
            label="Status categories"
            scanResultKey="statuses"
            categories={userConstants.statusCategories || []}
            onChange={names => handleCategoryChange('statusCategories', names)}
            activeLibrary={activeLibrary}
            onIndexUpdated={handleIndexUpdated}
            initialDetails={libraryIndex.statusCategoryDetails}
          />
        )}
        {tab === 6 && (
          <CookiesTab
            userConstants={userConstants}
            onChange={handleChange}
            activeLibrary={activeLibrary}
          />
        )}
      </Box>
    </Box>
  );
}

export default ConstantsPage;
