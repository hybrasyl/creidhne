import { z } from 'zod'

const PickerMode = z.enum(['vanilla', 'hybrasyl'])

// Mirrors the Settings shape owned by settingsManager.js. Extras pass
// through (zod default) — withDefaults strips them anyway, and the §13
// round-trip tripwire catches forgotten fields. The schema's job here is
// to refuse type-shape disasters (e.g. `libraries: "string"`) before
// they hit disk.
export const settingsSchema = z.object({
  libraries: z.array(z.string()),
  activeLibrary: z.string().nullable(),
  theme: z.string(),
  clientPath: z.string().nullable(),
  taliesinPath: z.string().nullable(),
  iconPickerMode: PickerMode,
  nationCrestPickerMode: PickerMode
})
