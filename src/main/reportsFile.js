import { promises as fs } from 'fs'
import { getCreidhneFilePath, ensureCreidhneDir } from './worldData.js'
import { reportsFileSchema, reportDefinitionSchema } from './schemas/reports.js'

// world/.creidhne/reports.json — a user's saved report definitions (WP2).
//
// It lives with the world rather than in the settings store because a report
// names castable fields and serves a team artifact: the balancing workbook. A
// report in the world repo is shareable and reviewable, and this folder already
// holds constants.json, formulas.json and map-catalog.json.
//
// The three built-in reports are NOT written here. They are code, they are fixed,
// and their column headers are a contract with two consumers outside this repo.

const EMPTY = { version: 1, reports: [] }

export function getReportsPath(libraryPath) {
  return getCreidhneFilePath(libraryPath, 'reports.json')
}

/**
 * Reads reports.json, keeping every report that validates.
 *
 * **One bad report must not cost the others.** This is a file a person can edit
 * by hand, and refusing the whole file over one stale field name would lose work
 * that is still good. So each report is validated on its own, and the rejected
 * ones come back as `problems` for the UI to show.
 *
 * A missing file is not a fault: it means no report has been saved yet.
 */
export async function loadReports(libraryPath) {
  let raw
  try {
    raw = JSON.parse(await fs.readFile(getReportsPath(libraryPath), 'utf-8'))
  } catch (err) {
    // ENOENT is the ordinary case. Anything else is a file that exists and
    // cannot be read, which the caller should see rather than have hidden as
    // "you have no reports".
    if (err?.code === 'ENOENT') return { ...EMPTY, problems: [] }
    return { ...EMPTY, problems: [`reports.json could not be read: ${err.message}`] }
  }

  if (raw?.version !== 1) {
    return {
      ...EMPTY,
      problems: [`reports.json has version ${JSON.stringify(raw?.version)}; this Creidhne reads 1`]
    }
  }

  const reports = []
  const problems = []
  for (const [i, entry] of (Array.isArray(raw.reports) ? raw.reports : []).entries()) {
    const parsed = reportDefinitionSchema.safeParse(entry)
    if (parsed.success) {
      reports.push(parsed.data)
      continue
    }
    const name = entry?.label ? `"${entry.label}"` : `entry ${i + 1}`
    for (const issue of parsed.error.issues) {
      const where = issue.path.join('.')
      problems.push(`${name}: ${where ? `${where} ` : ''}${issue.message}`)
    }
  }
  return { version: 1, reports, problems }
}

/**
 * Writes reports.json. Validates the whole file first, so a renderer bug cannot
 * put a definition on disk that the loader will then reject.
 */
export async function saveReports(libraryPath, reports) {
  const parsed = reportsFileSchema.parse({ version: 1, reports })
  await ensureCreidhneDir(libraryPath)
  await fs.writeFile(getReportsPath(libraryPath), `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
  return parsed
}
