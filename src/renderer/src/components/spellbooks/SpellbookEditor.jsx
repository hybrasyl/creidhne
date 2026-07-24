import { useMemo } from 'react'
import {
  Autocomplete,
  Box,
  Chip,
  Divider,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { useStoreValue, libraryIndexState } from '../../store/appStore'
import ConstantAutocomplete from '../shared/ConstantAutocomplete'
import IconCanvas from '../shared/IconCanvas'
import { typeFromBook } from '../../data/iconData'
import { resolveSpellbook } from '../../utils/spellbook'

/**
 * Editor + live preview for one spellbook. A book is a named bundle of
 * individual castables and/or castable categories; the preview resolves it to
 * the full castable set it covers (categories expanded to members).
 *
 * Props:
 *   book: { id, name, castables: string[], categories: string[] }
 *   onChange: (partial) => void  — merge a partial book update
 */
export default function SpellbookEditor({ book, onChange }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const castableOptions = libraryIndex?.castables || []
  const iconOf = (name) => libraryIndex?.castableIcons?.[name]
  const bookOf = (name) => libraryIndex?.castableBooks?.[name]

  const categories = book?.categories || []
  const castables = book?.castables || []

  const resolved = useMemo(
    () => resolveSpellbook(book, libraryIndex?.castableCategoryMembers),
    [book, libraryIndex]
  )

  // Which resolved castables come only from a category (not listed directly)?
  const directSet = useMemo(() => new Set(book?.castables || []), [book])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
        <TextField
          label="Name"
          size="small"
          fullWidth
          value={book?.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          helperText="Referenced as a single category on behavior sets."
          sx={{ mb: 2 }}
        />

        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
          Categories
        </Typography>
        <ConstantAutocomplete
          multiple
          indexKey="castableCategories"
          label="Castable categories"
          fullWidth
          value={categories}
          onChange={(vals) => onChange({ categories: vals })}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
            ))
          }
          sx={{ mt: 0.5, mb: 2 }}
        />

        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
          Individual castables
        </Typography>
        <Autocomplete
          multiple
          size="small"
          options={castableOptions}
          value={castables}
          onChange={(_, vals) => onChange({ castables: vals })}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="Add castables" />}
          sx={{ mt: 0.5 }}
        />
      </Box>

      <Divider />

      {/* Preview: the full resolved castable list this book covers. */}
      <Box
        sx={{ p: 2, flexShrink: 0, maxHeight: '38%', overflow: 'auto', bgcolor: 'action.hover' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
          <Typography variant="subtitle2">Preview</Typography>
          <Typography variant="caption" color="text.secondary">
            {resolved.length} castable{resolved.length === 1 ? '' : 's'}
            {categories.length
              ? ` · from ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`
              : ''}
            {castables.length ? ` · ${castables.length} direct` : ''}
          </Typography>
        </Stack>
        {resolved.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Add categories or castables to see the resolved spell list.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {resolved.map((name) => {
              // Solid ring = listed directly; plain = pulled in via a category.
              const direct = directSet.has(name)
              return (
                <Tooltip key={name} title={name} arrow>
                  <Box
                    sx={{
                      p: '2px',
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: direct ? 'primary.main' : 'transparent',
                      lineHeight: 0
                    }}
                  >
                    <IconCanvas type={typeFromBook(bookOf(name))} id={iconOf(name)} size={34} />
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
