import { z } from 'zod'

// Payload validation for the diagnostics:* IPC channels (parsed via parseOrLog at
// the boundary). Generous maxes just cap abuse — real payloads are far smaller.

export const rendererErrorSchema = z.object({
  source: z.string().max(40),
  message: z.string().max(10_000),
  stack: z.string().max(50_000).optional()
})

export const openIssueSchema = z.object({
  title: z.string().max(500),
  body: z.string().max(200_000)
})

export const copyReportSchema = z.object({
  body: z.string().max(200_000)
})
