import { useState } from 'react'
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
import { useStoreValue, activeLibraryState } from '../store/appStore'

// Full-height flex column so cards sharing a grid row match height (Settings pattern).
const cardSx = { p: 3, display: 'flex', flexDirection: 'column', height: '100%' }
const cardHeadingSx = { color: 'text.button', fontWeight: 'bold' }
const cardDescSx = { color: 'text.secondary', mb: 2 }
// Monospace blocks scroll inside their card instead of widening the grid column.
const preSx = {
  fontFamily: 'monospace',
  fontSize: 12,
  bgcolor: 'action.hover',
  p: 1.5,
  borderRadius: 1,
  overflowX: 'auto'
}

export default function HelpersPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
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
    <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ ...cardHeadingSx, mb: 3 }}>
        Lua Helpers
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(680px, 1fr))',
          gap: 3,
          alignItems: 'stretch'
        }}
      >
        {/* Install */}
        <Paper sx={cardSx}>
          <Typography variant="h6" gutterBottom sx={cardHeadingSx}>
            Set up Lua IntelliSense
          </Typography>
          <Typography variant="body2" sx={cardDescSx}>
            Copies the Hybrasyl Lua type stubs and a <code>.luarc.json</code> config into your
            active library&apos;s <code>world/scripts/</code> directory. Once installed, the{' '}
            <strong>sumneko Lua language server</strong> (used by VS Code&apos;s Lua extension) will
            provide IntelliSense, autocomplete, and type checking for the Hybrasyl API — including
            methods on <code>world</code>, <code>source</code>, <code>target</code>, dialog
            builders, and more.
          </Typography>

          <Typography variant="body2" sx={cardDescSx}>
            <strong>What gets written:</strong>
          </Typography>
          <Box component="pre" sx={{ ...preSx, mb: 2 }}>
            {`world/scripts/
├── .luarc.json              ← sumneko config (runtime, globals, library path)
└── .hybrasyl-types/         ← Lua annotation stubs (auto-generated from server C#)
    ├── HybrasylUser.lua
    ├── HybrasylWorld.lua
    ├── HybrasylDialog.lua
    └── … (33 files)`}
          </Box>
          <Typography variant="body2" sx={cardDescSx}>
            Safe to re-run — overwrites stubs with the latest bundled version. Your scripts are
            never touched.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 'auto' }}>
            <Button
              variant="contained"
              startIcon={
                installing ? <CircularProgress size={14} color="inherit" /> : <BuildIcon />
              }
              onClick={handleSetupLua}
              disabled={installing || !activeLibrary}
            >
              {installing ? 'Installing…' : 'Install Lua types + .luarc.json'}
            </Button>
            {!activeLibrary && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Select an active library in Settings first.
              </Typography>
            )}
          </Stack>

          {result && (
            <Box sx={{ mt: 2 }}>
              {result.ok ? (
                <Alert severity="success">
                  Installed {result.stubsCopied} type stubs to <code>{result.typesDir}</code> and
                  wrote <code>{result.luarcDest}</code>. Open <code>world/scripts/</code> in VS Code
                  and the Lua extension will pick them up.
                </Alert>
              ) : (
                <Alert severity="error">Failed: {result.error}</Alert>
              )}
            </Box>
          )}
        </Paper>

        {/* VS Code setup tips */}
        <Paper sx={cardSx}>
          <Typography variant="h6" gutterBottom sx={cardHeadingSx}>
            VS Code setup tips
          </Typography>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              <strong>1.</strong> Install the{' '}
              <Typography component="span" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                sumneko.lua
              </Typography>{' '}
              extension in VS Code (search &quot;Lua&quot; by sumneko in the extensions panel).
            </Typography>
            <Typography variant="body2">
              <strong>2.</strong> Click &quot;Install Lua types&quot; to deploy the stubs + config.
            </Typography>
            <Typography variant="body2">
              <strong>3.</strong> Open <code>world/scripts/</code> as a VS Code workspace (or add it
              to your existing workspace).
            </Typography>
            <Typography variant="body2">
              <strong>4.</strong> Start typing — IntelliSense for <code>world:</code>,{' '}
              <code>source:</code>, <code>target:</code>, dialog sequences, and all Hybrasyl-exposed
              types should appear.
            </Typography>
          </Stack>
          {/* mt:auto pins the footnote to the bottom so tiled cards line up. */}
          <Divider sx={{ mt: 'auto', mb: 2, pt: 2 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            The stubs are auto-generated from the Hybrasyl C# server source via{' '}
            <code>scripts/generate-lua-stubs.js</code>. Re-run that script if the server API
            changes, then click &quot;Install Lua types&quot; again to push the updates.
          </Typography>
        </Paper>

        {/* Troubleshooting — manual equivalents of what .luarc.json already sets */}
        <Paper sx={cardSx}>
          <Typography variant="h6" gutterBottom sx={cardHeadingSx}>
            Still seeing warnings?
          </Typography>
          <Typography variant="body2" sx={cardDescSx}>
            The <code>.luarc.json</code> written above already applies all of these, so you normally
            need to do nothing. They only matter if <code>world/scripts/</code> isn&apos;t your VS
            Code workspace root — sumneko reads <code>.luarc.json</code> from the workspace root
            only. In that case set the same values in Settings (<code>Ctrl+,</code>):
          </Typography>
          <Box component="pre" sx={{ ...preSx, mb: 2 }}>
            {`Lua › Diagnostics: Disable          add  lowercase-global
                                   add  undefined-global
Lua › Runtime: Nonstandard Symbol   add  !=`}
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            <code>lowercase-global</code> and <code>undefined-global</code> silence the Hybrasyl
            magic globals (<code>world</code>, <code>source</code>, <code>target</code>, …), and{' '}
            <code>!=</code> stops Hybrasyl&apos;s accepted inequality operator being flagged as a
            syntax error.
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}
