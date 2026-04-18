import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  Stack,
  CircularProgress,
  Divider
} from '@mui/material'
import BuildIcon from '@mui/icons-material/Build'
import { useRecoilValue } from 'recoil'
import { activeLibraryState } from '../recoil/atoms'

export default function HelpersPage() {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [installing, setInstalling] = useState(false)
  const [result, setResult] = useState(null)

  const handleSetupLua = async () => {
    if (!activeLibrary) return
    setInstalling(true)
    setResult(null)
    try {
      const res = await window.electronAPI.setupLuaEnvironment(activeLibrary)
      setResult(res)
    } catch (err) {
      setResult({ ok: false, error: err?.message || String(err) })
    } finally {
      setInstalling(false)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'text.button', fontWeight: 'bold' }}>
        Lua Helpers
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Set up Lua IntelliSense</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Copies the Hybrasyl Lua type stubs and a <code>.luarc.json</code> config into your
          active library's <code>world/scripts/</code> directory. Once installed, the{' '}
          <strong>sumneko Lua language server</strong> (used by VS Code's Lua extension) will
          provide IntelliSense, autocomplete, and type checking for the Hybrasyl API — including
          methods on <code>world</code>, <code>source</code>, <code>target</code>, dialog
          builders, and more.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>What gets written:</strong>
        </Typography>
        <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: 2 }}>
          {`world/scripts/
├── .luarc.json              ← sumneko config (runtime, globals, library path)
└── .hybrasyl-types/         ← Lua annotation stubs (auto-generated from server C#)
    ├── HybrasylUser.lua
    ├── HybrasylWorld.lua
    ├── HybrasylDialog.lua
    └── … (20 files)`}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Safe to re-run — overwrites stubs with the latest bundled version. Your scripts are never touched.
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            startIcon={installing ? <CircularProgress size={14} color="inherit" /> : <BuildIcon />}
            onClick={handleSetupLua}
            disabled={installing || !activeLibrary}
          >
            {installing ? 'Installing…' : 'Install Lua types + .luarc.json'}
          </Button>
          {!activeLibrary && (
            <Typography variant="caption" color="text.secondary">
              Select an active library in Settings first.
            </Typography>
          )}
        </Stack>

        {result && (
          <Box sx={{ mt: 2 }}>
            {result.ok ? (
              <Alert severity="success">
                Installed {result.stubsCopied} type stubs to <code>{result.typesDir}</code> and
                wrote <code>{result.luarcDest}</code>.
                Open <code>world/scripts/</code> in VS Code and the Lua extension will pick them up.
              </Alert>
            ) : (
              <Alert severity="error">Failed: {result.error}</Alert>
            )}
          </Box>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>VS Code setup tips</Typography>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            <strong>1.</strong> Install the{' '}
            <Typography component="span" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
              sumneko.lua
            </Typography>{' '}
            extension in VS Code (search "Lua" by sumneko in the extensions panel).
          </Typography>
          <Typography variant="body2">
            <strong>2.</strong> Click "Install Lua types" above to deploy the stubs + config.
          </Typography>
          <Typography variant="body2">
            <strong>3.</strong> Open <code>world/scripts/</code> as a VS Code workspace (or add it to your existing workspace).
          </Typography>
          <Typography variant="body2">
            <strong>4.</strong> Start typing — IntelliSense for <code>world:</code>, <code>source:</code>, <code>target:</code>, dialog
            sequences, and all Hybrasyl-exposed types should appear.
          </Typography>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            The stubs are auto-generated from the Hybrasyl C# server source via <code>scripts/generate-lua-stubs.js</code>.
            Re-run that script if the server API changes, then click "Install Lua types" again to push the updates.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}
