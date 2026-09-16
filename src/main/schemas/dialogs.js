import { z } from 'zod'
import {
  DIALOG_KINDS,
  SEQUENCE_SCOPES,
  DOCUMENT_NAME_PATTERN,
  DIALOG_SCHEMA_VERSION
} from '../../shared/dialogDocument.js'

// A dialog document at the IPC boundary and on disk (HTOO-458).
//
// Deliberately STRUCTURAL, not semantic. A save must accept a draft with a
// dangling jump or an empty text, because a writer saves work in progress;
// `validateDialogDocument` (shared) is the semantic gate, and it guards EXPORT.
// What this schema refuses is a shape the editor cannot load — an unknown
// dialog kind, a sequence that is not an array, a name that would not be a Lua
// identifier and so could not name the file or the table.
//
// The kinds and scopes come from the shared vocabulary rather than being
// restated, so the editor cannot offer a kind the loader then refuses.

const nonEmpty = z.string().min(1)
const str = z.string().default('')

const Option = z.object({
  id: nonEmpty,
  label: str,
  target: z.discriminatedUnion('type', [
    z.object({ type: z.literal('jump'), sequence: str }),
    z.object({ type: z.literal('callback'), expr: str })
  ]),
  check: str
})

const Dialog = z
  .object({
    id: nonEmpty,
    kind: z.enum(DIALOG_KINDS),
    text: str,
    required: z.boolean().default(false),
    callback: str,
    handler: str,
    sequence: str,
    expr: str,
    topCaption: str,
    bottomCaption: str,
    maxLength: z.number().int().optional(),
    options: z.array(Option).optional()
  })
  .passthrough()

const Sequence = z.object({
  id: nonEmpty,
  name: str,
  scope: z.enum(SEQUENCE_SCOPES).default('local'),
  menuCheck: str,
  displayName: str,
  sprite: str,
  associateWithScript: z.boolean().default(false),
  dialogs: z.array(Dialog).default([])
})

export const dialogDocumentSchema = z.object({
  schemaVersion: z.literal(DIALOG_SCHEMA_VERSION),
  name: z.string().regex(DOCUMENT_NAME_PATTERN, 'must be lower snake case starting with a letter'),
  title: str,
  description: str,
  sequences: z.array(Sequence).default([])
})

/** `dialogs:delete` names a document; the name is also the file's basename. */
export const dialogNameSchema = z.string().regex(DOCUMENT_NAME_PATTERN)
