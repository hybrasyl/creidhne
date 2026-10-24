import { useLayoutEffect, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Pagination,
  Paper,
  Radio,
  Slider,
  Switch,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material'
import { ThemeProvider, useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import StarIcon from '@mui/icons-material/Star'
import ThemePicker from '@renderer/components/ThemePicker'
import { useStoreState, themeState } from '@renderer/store/appStore'
import { blend, contrast, parseColor } from '@renderer/lib/contrast'
import { themesByName } from '@renderer/themes'
import {
  GLYPHS,
  LOGO_FILTER,
  TITLE_SHADOW,
  chromeKind,
  navButtonSx,
  windowButtonSx
} from '@renderer/components/titleChrome'
import { appIdentity } from '@shared/appIdentity.js'
import appIcon from '@renderer/assets/creidhne.webp'

// Creidhne has no shared theme-name list, so the registry is the list.
const THEME_NAMES = Object.keys(themesByName)

/**
 * The theme gallery (HTOO-572). It shows each control that the house apps
 * render, in the active theme, on the page and on paper, for a person to
 * review by eye. Each sample shows the contrast that it draws, measured from
 * the DOM: text against 4.5:1, icons and marks against 3:1. A red ratio is
 * below its threshold.
 *
 * The "used by" lines come from a survey of the ten house apps, the website and the
 * template (2026-10-23). They show whose screens a palette change touches.
 * A fork can delete this page, or keep it to review its own overrides.
 *
 * The JavaScript edition of the template's ThemeGallery.tsx, for Creidhne.
 * Creidhne opens it from Settings → Appearance → Theme gallery. It shows in
 * place of the Settings cards, so its "on the page" samples sit on the real
 * page. The title-bar previews show the Creidhne icon and name.
 */

/** The surveyed apps, in the survey's order. */
export const SURVEYED_APPS = [
  'oghma',
  'creidhne',
  'epona',
  'balor',
  'dagda',
  'corvath',
  'midir',
  'elatha',
  'mabon',
  'taliesin',
  'website',
  'template'
]

const ALL = 'all 12'
const COLORS = ['primary', 'secondary', 'error', 'warning', 'info', 'success']
const SEVERITIES = ['error', 'warning', 'info', 'success']

/**
 * `secondary` is a fill only: the bar colour, with secondary.contrastText on
 * it. As text or an outline on the page it cannot read in every theme (HTOO-572),
 * so the gallery shows those samples with no threshold.
 */
const NOT_TEXT = 'secondary'

/** The colour behind `el`: each translucent fill up the tree, over the first opaque one. */
function drawnBackground(el, page) {
  const layers = []
  for (let n = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor
    if (!bg || bg === 'transparent') continue
    const alpha = parseColor(bg)[3]
    if (alpha === 0) continue
    layers.push(bg)
    if (alpha >= 1) break
  }
  let under = page
  for (const layer of layers.reverse()) under = blend(layer, under)
  return under
}

/**
 * The opacity that `el` draws at: its own times each ancestor's. getComputedStyle
 * does not fold it into `color`, so a faded caption measured as if it were solid
 * (taliesin's nav bar: 6:1 measured, 3.84:1 on screen, HTOO-572).
 */
function drawnOpacity(el) {
  let opacity = 1
  for (let n = el; n; n = n.parentElement) {
    opacity *= Number(getComputedStyle(n).opacity || '1')
  }
  return opacity
}

/** The contrast that `el` draws its text or icon at, on what is behind it. */
function drawnContrast(el, page) {
  try {
    const under = drawnBackground(el, page)
    const [r, g, b, a] = parseColor(getComputedStyle(el).color)
    const drawn = `rgba(${r}, ${g}, ${b}, ${a * drawnOpacity(el)})`
    return contrast(blend(drawn, under), under)
  } catch {
    return null
  }
}

/**
 * MUI fades colours over 250 ms or less. A theme change starts those fades, so
 * the first measurement reads colours part of the way. Measure again after this.
 */
const SETTLE_MS = 400

/** A sample with its measured contrast under it. */
function Measure({ children, min = 4.5, part }) {
  const theme = useTheme()
  const ref = useRef(null)
  const [ratio, setRatio] = useState(null)

  useLayoutEffect(() => {
    const measure = () => {
      const sample = ref.current?.firstElementChild
      const el = (part && sample?.querySelector(part)) || sample
      setRatio(el ? drawnContrast(el, theme.palette.background.default) : null)
    }
    measure()
    const settled = setTimeout(measure, SETTLE_MS)
    return () => clearTimeout(settled)
  }, [theme, part])

  const pass = ratio !== null && ratio >= min
  return (
    <Box
      component="span"
      ref={ref}
      sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
    >
      {children}
      <Box
        component="span"
        data-testid="gallery-ratio"
        data-pass={pass}
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          px: 0.5,
          borderRadius: 0.5,
          // Fixed colours, not theme ones: the badge must read the same in every
          // theme. Grey has no threshold: a disabled control (WCAG holds it to
          // none), or a use the house does not make (NOT_TEXT).
          bgcolor: min === 0 ? '#616161' : pass ? '#1b5e20' : '#b71c1c',
          color: '#ffffff'
        }}
      >
        {ratio === null ? '?' : ratio.toFixed(2)}
      </Box>
    </Box>
  )
}

function Row({ label, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
        {children}
      </Box>
    </Box>
  )
}

/** One section, drawn three times: on the page, on paper and on paperDark. */
function Section({ title, usedBy, children }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ color: 'text.button' }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Used by: {usedBy}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 2
        }}
      >
        <Box data-surface="page" sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            On the page
          </Typography>
          {children}
        </Box>
        <Paper data-surface="paper" sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            On paper
          </Typography>
          {children}
        </Paper>
        {/* The panel and tooltip surface: a sidebar, a log panel, a tooltip. */}
        <Box
          data-surface="paperDark"
          sx={{ p: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paperDark' }}
        >
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            On paperDark
          </Typography>
          {children}
        </Box>
      </Box>
    </Box>
  )
}

function Buttons() {
  return (
    <>
      {['text', 'outlined', 'contained'].map((variant) => (
        <Row key={variant} label={`${variant} buttons`}>
          {['inherit', ...COLORS].map((color) => (
            <Measure key={color} min={color === NOT_TEXT && variant !== 'contained' ? 0 : 4.5}>
              <Button variant={variant} color={color} startIcon={<AddIcon />}>
                {color}
              </Button>
            </Measure>
          ))}
          <Measure min={0}>
            <Button variant={variant} disabled>
              disabled
            </Button>
          </Measure>
          <Measure>
            <Button variant={variant} startIcon={<CircularProgress size={14} color="inherit" />}>
              busy
            </Button>
          </Measure>
        </Row>
      ))}
    </>
  )
}

function IconButtons() {
  return (
    <Row label="icon buttons (3:1)">
      {['default', 'inherit', ...COLORS].map((color) => (
        <Tooltip key={color} title={color}>
          <span>
            <Measure min={color === NOT_TEXT ? 0 : 3} part="svg">
              <IconButton color={color} aria-label={color}>
                <DeleteIcon />
              </IconButton>
            </Measure>
          </span>
        </Tooltip>
      ))}
    </Row>
  )
}

function Chips() {
  return (
    <>
      {['filled', 'outlined'].map((variant) => (
        <Row key={variant} label={`${variant} chips`}>
          {['default', ...COLORS].map((color) => (
            <Measure key={color} min={color === NOT_TEXT && variant === 'outlined' ? 0 : 4.5}>
              <Chip variant={variant} color={color} label={color} onClick={() => {}} />
            </Measure>
          ))}
          <Measure>
            <Chip variant={variant} label="deletable" size="small" onDelete={() => {}} />
          </Measure>
        </Row>
      ))}
    </>
  )
}

function Alerts() {
  return (
    <>
      {['standard', 'outlined', 'filled'].map((variant) => (
        <Row key={variant} label={`${variant} alerts, with an inherit action and a close X`}>
          {SEVERITIES.map((severity) => (
            <Measure key={severity}>
              <Alert
                variant={variant}
                severity={severity}
                onClose={() => {}}
                action={
                  <>
                    <Button color="inherit" size="small">
                      Undo
                    </Button>
                    <IconButton color="inherit" size="small" aria-label="Close">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                }
                sx={{ minWidth: 300 }}
              >
                A {severity} message.
              </Alert>
            </Measure>
          ))}
        </Row>
      ))}
    </>
  )
}

/**
 * The house rule for a status fill: `main` with `contrastText`. A fill of
 * `.dark` picks its label against `.dark` with getContrastText, because
 * `contrastText` is picked against `main` and can be dark on a dark `.dark`
 * (elatha's error strip, 2.8:1).
 */
function StatusFills() {
  const theme = useTheme()
  const fill = { px: 1.5, py: 0.5, borderRadius: 1 }
  return (
    <>
      <Row label="main, with contrastText">
        {SEVERITIES.map((s) => (
          <Measure key={s}>
            <Box sx={{ ...fill, bgcolor: `${s}.main`, color: `${s}.contrastText` }}>{s}</Box>
          </Measure>
        ))}
      </Row>
      <Row label=".dark, with its own label (getContrastText)">
        {SEVERITIES.map((s) => (
          <Measure key={s}>
            <Box
              sx={{
                ...fill,
                bgcolor: `${s}.dark`,
                color: theme.palette.getContrastText(theme.palette[s].dark)
              }}
            >
              {s}
            </Box>
          </Measure>
        ))}
      </Row>
    </>
  )
}

function Selection() {
  const [tab, setTab] = useState(0)
  const [toggle, setToggle] = useState(['bold'])
  return (
    <>
      <Row label="checkbox, radio, switch (3:1)">
        <Measure min={3} part="svg">
          <Checkbox defaultChecked />
        </Measure>
        <Measure min={3} part="svg">
          <Checkbox />
        </Measure>
        <Measure min={3} part="svg">
          <Checkbox indeterminate />
        </Measure>
        <Measure min={3} part="svg">
          <Radio checked />
        </Measure>
        <FormControlLabel control={<Switch defaultChecked />} label="switch" />
        <FormControlLabel control={<Switch defaultChecked color="info" />} label="info switch" />
        <FormControlLabel control={<Switch />} label="off" />
      </Row>
      <Row label="slider">
        <Slider defaultValue={40} sx={{ width: 200 }} aria-label="slider" />
      </Row>
      <Row label="toggle buttons">
        <ToggleButtonGroup value={toggle} onChange={(_, v) => setToggle(v)} size="small">
          <ToggleButton value="bold" aria-label="bold">
            <FormatBoldIcon />
          </ToggleButton>
          <ToggleButton value="italic" aria-label="italic">
            <FormatItalicIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Row>
      <Row label="tabs">
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Selected" />
          <Tab label="Other" />
          <Tab label="Third" />
        </Tabs>
      </Row>
    </>
  )
}

function Progress() {
  return (
    <>
      <Row label="circular: default, info, inherit">
        <CircularProgress size={24} />
        <CircularProgress size={24} color="info" />
        <Box sx={{ color: 'text.primary' }}>
          <CircularProgress size={24} color="inherit" />
        </Box>
      </Row>
      <Row label="linear: determinate, indeterminate">
        <Box sx={{ width: 240, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <LinearProgress variant="determinate" value={60} />
          <LinearProgress />
        </Box>
      </Row>
      <Row label="badges">
        <Badge color="primary" variant="dot">
          <StarIcon />
        </Badge>
        <Badge color="error" badgeContent={3}>
          <StarIcon />
        </Badge>
        <Badge color="primary" badgeContent={12}>
          <StarIcon />
        </Badge>
      </Row>
    </>
  )
}

function Text() {
  // In a light theme primary.light is lighter than main, and main is near 4.5:1
  // on the page, so light cannot be text there. Use main.
  const light = useTheme().palette.mode === 'light'
  const tokens = [
    'text.primary',
    'text.secondary',
    'text.disabled',
    'text.button',
    'text.headline',
    'primary.main',
    'primary.light',
    'error.main',
    'warning.main',
    'success.main'
  ]
  return (
    <>
      <Row label="text colours">
        {tokens.map((t) => (
          <Measure
            key={t}
            min={t === 'text.disabled' || (light && t === 'primary.light') ? 0 : 4.5}
          >
            <Typography sx={{ color: t }}>{t}</Typography>
          </Measure>
        ))}
      </Row>
      <Row label="links">
        <Measure>
          <Link href="#gallery">link</Link>
        </Measure>
        <Measure>
          <Link href="#gallery" variant="body2">
            body2 link
          </Link>
        </Measure>
        <Measure>
          <Link href="#gallery" color="inherit">
            inherit link
          </Link>
        </Measure>
        <Measure>
          {/* A plain <a>, as Markdown draws it: the MuiCssBaseline rule. */}
          <a href="#gallery">plain a</a>
        </Measure>
      </Row>
      <Row label="icons with a colour (3:1)">
        {['inherit', 'action', 'disabled', 'primary', 'error', 'warning', 'success'].map(
          (color) => (
            <Measure key={color} min={color === 'disabled' ? 0 : 3}>
              <StarIcon color={color} />
            </Measure>
          )
        )}
      </Row>
    </>
  )
}

function Surfaces() {
  const [page, setPage] = useState(2)
  return (
    <>
      <Row label="list, selected and plain">
        <List dense sx={{ width: 220, p: 0 }}>
          <ListItemButton selected>
            <ListItemText primary="Selected" />
          </ListItemButton>
          <ListItemButton>
            <ListItemText primary="Plain" />
          </ListItemButton>
        </List>
      </Row>
      <Row label="pagination: a page, then the selected page">
        {/* The audit had no sample here, and two themes' page buttons were below
            4.5:1 (HTOO-572). Hover is checked from the theme in palette.test. */}
        <Measure part=".MuiPaginationItem-page:not(.Mui-selected)">
          <Pagination count={5} page={page} onChange={(_, p) => setPage(p)} />
        </Measure>
        <Measure part=".MuiPaginationItem-page.Mui-selected">
          <Pagination count={5} page={page} onChange={(_, p) => setPage(p)} />
        </Measure>
      </Row>
      <Row label="inputs">
        <TextField size="small" label="Label" defaultValue="Value" />
        <TextField size="small" label="Error" error defaultValue="Bad" />
      </Row>
      <Row label="accordion">
        <Accordion sx={{ width: 320 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Accordion</AccordionSummary>
          <AccordionDetails>Details.</AccordionDetails>
        </Accordion>
      </Row>
    </>
  )
}

function BarButtons({ kind, hovered }) {
  const plain = kind === 'plain'
  const buttons = [
    ['Minimize', plain ? GLYPHS.minimize.plain : GLYPHS.minimize.decorated, false],
    ['Maximize', plain ? GLYPHS.maximize.plain : GLYPHS.maximize.decorated, false],
    ['Close', plain ? GLYPHS.close.plain : GLYPHS.close.decorated, true]
  ]
  return (
    <>
      {buttons.map(([label, Glyph, close]) => (
        <Measure key={label} min={3} part="svg">
          <IconButton
            size="small"
            aria-label={`${label}${hovered ? ', hovered' : ''}`}
            sx={windowButtonSx(kind, close, hovered)}
          >
            <Glyph />
          </IconButton>
        </Measure>
      ))}
    </>
  )
}

/**
 * A nav bar under the title bar, as four apps draw one: a plain button, the
 * current page, and a hovered button, with `navButtonSx`.
 */
function NavBarPreview({ kind }) {
  const buttons = [
    ['Home', false, false],
    ['Current page', true, false],
    ['Hovered', false, true]
  ]
  return (
    <Toolbar
      variant="dense"
      disableGutters
      sx={{ bgcolor: 'secondary.main', minHeight: 40, px: 3, gap: 1 }}
    >
      {buttons.map(([label, current, hovered]) => (
        <Measure key={label} part="svg">
          <IconButton size="small" aria-label={label} sx={navButtonSx(kind, current, hovered)}>
            <StarIcon />
          </IconButton>
        </Measure>
      ))}
    </Toolbar>
  )
}

/** One title bar, drawn in its own theme with the chrome that TitleBar uses. */
function BarPreview({ name }) {
  const kind = chromeKind(name)
  return (
    <ThemeProvider theme={themesByName[name]}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {name} ({kind}). At rest, then hovered. Under it, a nav bar.
        </Typography>
        <Toolbar
          variant="dense"
          disableGutters
          sx={{ bgcolor: 'secondary.main', minHeight: 36, px: 3, py: 0.5, gap: 1 }}
        >
          <Box
            component="img"
            src={appIcon}
            alt=""
            aria-hidden
            sx={{ height: 24, width: 24, objectFit: 'contain', filter: LOGO_FILTER[kind] }}
          />
          <Measure>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                '&&': { fontSize: '1.5rem' },
                color: 'secondary.contrastText',
                textShadow: TITLE_SHADOW[kind]
              }}
            >
              {appIdentity.productName}
            </Typography>
          </Measure>
          <Box sx={{ flexGrow: 1 }} />
          <BarButtons kind={kind} hovered={false} />
          <Box sx={{ width: 16 }} />
          <BarButtons kind={kind} hovered />
        </Toolbar>
        <NavBarPreview kind={kind} />
      </Box>
    </ThemeProvider>
  )
}

function TitleBars() {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ color: 'text.button' }}>
        Title bars
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Used by: the ten apps (creidhne: AppTitleBar, and its nav bar under it takes the same
        colours and hover). The website draws an AppBar instead; see Navigation. Each bar is in its
        own theme, so all of them show at once.
      </Typography>
      {THEME_NAMES.map((name) => (
        <BarPreview key={name} name={name} />
      ))}
    </Box>
  )
}

/**
 * The website's top navigation: an AppBar that the theme's MuiAppBar override
 * paints, with outlined links and a contained secondary call to action on it.
 * The apps' title bars paint secondary.main instead (Title bars, above).
 */
function Navigation() {
  return (
    <Row label="app bar with a title, outlined links and a secondary call to action">
      <AppBar position="static" sx={{ px: 2, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Measure>
            <Typography variant="h5" sx={{ color: 'text.button' }}>
              Hybrasyl
            </Typography>
          </Measure>
          <Measure>
            {/* The AppBar's own text colour. The website uses secondary.contrastText
            here, which is for the secondary.main bar, not an AppBar. */}
            <Button variant="outlined" color="inherit">
              Lore
            </Button>
          </Measure>
          <Measure>
            <Button variant="contained" color="secondary">
              Begin
            </Button>
          </Measure>
          <Measure min={3} part="svg">
            <IconButton aria-label="Palette" sx={{ color: 'text.button' }}>
              <StarIcon />
            </IconButton>
          </Measure>
        </Box>
      </AppBar>
    </Row>
  )
}

function ThemeGallery({ onBack }) {
  const [theme, setTheme] = useStoreState(themeState)
  return (
    <Box data-testid="theme-gallery-page" id="gallery" sx={{ flex: 1, overflow: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
        <Typography variant="h4">Theme gallery</Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Surveyed apps: {SURVEYED_APPS.join(', ')}. A green ratio passes; a red one is below 4.5:1
        for text or 3:1 for an icon. A grey one has no threshold: a disabled control, secondary as
        text (it is a fill only), or primary.light as text in a light theme. Hover the controls to
        see their hover states.
      </Typography>
      <Box sx={{ mb: 3 }}>
        <ThemePicker value={theme} onChange={setTheme} />
      </Box>
      <TitleBars />
      <Section title="Buttons" usedBy={ALL}>
        <Buttons />
      </Section>
      <Section title="Icon buttons" usedBy={ALL}>
        <IconButtons />
      </Section>
      <Section
        title="Chips"
        usedBy="oghma, creidhne, epona, balor, dagda, corvath, midir, mabon, taliesin, website"
      >
        <Chips />
      </Section>
      <Section
        title="Alerts"
        usedBy={`${ALL}; the website uses standard info only (filled: the update notice in the apps)`}
      >
        <Alerts />
      </Section>
      <Section
        title="Status fills"
        usedBy="status strips and banners (elatha), filled chips and alerts in every app"
      >
        <StatusFills />
      </Section>
      <Section
        title="Selection: checkbox, switch, slider, toggles, tabs"
        usedBy="the 11 apps; the website uses toggles and tabs only"
      >
        <Selection />
      </Section>
      <Section
        title="Progress and badges"
        usedBy="the 11 apps; the website uses circular progress only (primary, secondary, default)"
      >
        <Progress />
      </Section>
      <Section title="Text, links and icons" usedBy={ALL}>
        <Text />
      </Section>
      <Section
        title="Lists, pagination, inputs, accordion"
        usedBy="lists and inputs: all 12; accordion: creidhne, epona, dagda, midir, taliesin, website"
      >
        <Surfaces />
      </Section>
      <Section
        title="Navigation: app bar"
        usedBy="website (desktop and mobile nav); creidhne, corvath, taliesin"
      >
        <Navigation />
      </Section>
    </Box>
  )
}

export default ThemeGallery
