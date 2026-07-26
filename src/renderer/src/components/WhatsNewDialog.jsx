import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  List,
  ListItem,
  Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
// The changelog is the single source of user-facing release notes. Import it as
// a raw string at build time (bundled into the renderer, works in dev + packaged
// builds) rather than reading the file at runtime.
import changelogRaw from '../../../../CHANGELOG.md?raw'

// Inline formatting the changelog actually uses: [text](url), **bold**, `code`,
// _italic_. Rendered to React nodes; anything else passes through as plain text.
const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|_([^_]+)_/g

function renderInline(text, kp) {
  const out = []
  let last = 0
  let idx = 0
  let m
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${kp}-${idx++}`
    if (m[1] != null) {
      out.push(
        <Link key={key} href={m[2]} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </Link>
      )
    } else if (m[3] != null) {
      out.push(<strong key={key}>{m[3]}</strong>)
    } else if (m[4] != null) {
      out.push(
        <Box
          key={key}
          component="code"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.85em',
            px: 0.5,
            py: '1px',
            borderRadius: 0.5,
            bgcolor: 'action.hover'
          }}
        >
          {m[4]}
        </Box>
      )
    } else if (m[5] != null) {
      out.push(<em key={key}>{m[5]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Parse the changelog markdown into a flat block list. Handles the Keep a
// Changelog structure the file uses: ## version, ### section, "- " bullets
// (with wrapped continuation lines), and plain paragraphs. HTML comments and the
// top-level "# Changelog" title are dropped (the dialog has its own title).
function parseBlocks(md) {
  const clean = md.replace(/<!--[\s\S]*?-->/g, '')
  const lines = clean.split(/\r?\n/)
  const blocks = []
  let list = null
  let para = null
  const flushPara = () => {
    if (para) {
      blocks.push({ type: 'p', text: para })
      para = null
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'ul', items: list })
      list = null
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    let m
    if (/^#\s+/.test(line)) {
      // top-level title — skip
      flushPara()
      flushList()
    } else if ((m = /^##\s+(.*)/.exec(line))) {
      flushPara()
      flushList()
      blocks.push({ type: 'version', text: m[1] })
    } else if ((m = /^###\s+(.*)/.exec(line))) {
      flushPara()
      flushList()
      blocks.push({ type: 'section', text: m[1] })
    } else if ((m = /^[-*]\s+(.*)/.exec(line))) {
      flushPara()
      if (!list) list = []
      list.push(m[1])
    } else if (list) {
      list[list.length - 1] += ` ${line.trim()}`
    } else {
      para = para ? `${para} ${line.trim()}` : line.trim()
    }
  }
  flushPara()
  flushList()
  return blocks
}

const BLOCKS = parseBlocks(changelogRaw)

export default function WhatsNewDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
        What&apos;s New
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {BLOCKS.map((b, i) => {
          if (b.type === 'version') {
            return (
              <Box key={i} sx={{ mt: i === 0 ? 0 : 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {renderInline(b.text, `v${i}`)}
                </Typography>
                <Divider sx={{ mt: 0.5 }} />
              </Box>
            )
          }
          if (b.type === 'section') {
            return (
              <Typography
                key={i}
                variant="overline"
                sx={{ display: 'block', mt: 1.5, color: 'text.secondary', fontWeight: 'bold' }}
              >
                {b.text}
              </Typography>
            )
          }
          if (b.type === 'ul') {
            return (
              <List key={i} dense disablePadding sx={{ listStyleType: 'disc', pl: 3 }}>
                {b.items.map((it, j) => (
                  <ListItem key={j} sx={{ display: 'list-item', px: 0, py: 0.25 }}>
                    <Typography variant="body2">{renderInline(it, `${i}-${j}`)}</Typography>
                  </ListItem>
                ))}
              </List>
            )
          }
          return (
            <Typography key={i} variant="body2" sx={{ mt: 1 }}>
              {renderInline(b.text, `p${i}`)}
            </Typography>
          )
        })}
      </DialogContent>
    </Dialog>
  )
}
