import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Every packaging target `electron-builder.yml` declares must reach the published
 * release, and this file is the only thing that can say so on a commit.
 *
 * **It exists because the answer was no somewhere else, and nothing noticed for
 * months.** Taliesin's config declared both `nsis` and `portable`; its
 * `build-windows` job ran `--win portable`; and its release job had no glob for
 * an installer. Every release published four assets where five were configured,
 * and every gate passed the whole time — the config was right, the workflow was
 * valid YAML, and an unmatched-files check says nothing at all about a file
 * **nobody asked for**. *A requirement expressed only as a list of globs cannot
 * report the entry that is missing from the list.*
 *
 * Creidhne is the inverse case (HTOO-373): it shipped `portable` only and had no
 * installer target to lose. Adding `nsis` puts it in exactly the shape the defect
 * lives in — a target list, a packaging step, a signing step, an upload step and
 * a release glob, five places that must agree — so the guard lands with it rather
 * than after it.
 *
 * Read as raw text rather than parsed, for the reason `verify-fuses.test.mjs`
 * gives about the fuse block: there is no YAML dependency here, these are files
 * the repository owns, and the job is to catch a human edit rather than to be a
 * general parser.
 */

const REPO_ROOT = join(import.meta.dirname, '..')
const builder = readFileSync(join(REPO_ROOT, 'electron-builder.yml'), 'utf8')
const workflowRaw = readFileSync(join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8')

/**
 * Comments out before any anchored pattern is matched.
 *
 * The comment explaining why the packaging step must not name a target
 * necessarily contains the form it is forbidding, so an assertion that reads the
 * raw file fails against a correct workflow. Describe the pattern; never write
 * it.
 */
const workflow = workflowRaw.replace(/^\s*#.*$/gm, '')

/** The body of one step, from its `- name:` to the next step, comments stripped. */
function step(name) {
  const start = workflow.indexOf(`- name: ${name}`)
  expect(start, `release.yml has no step named "${name}"`).toBeGreaterThan(-1)
  const next = workflow.indexOf('\n      - ', start + 1)
  return workflow.slice(start, next === -1 ? undefined : next)
}

/** The build-windows job, from its key to the next job, comments stripped. */
const windowsJob = (() => {
  const start = workflow.indexOf('\n  build-windows:')
  expect(start).toBeGreaterThan(-1)
  const next = workflow.slice(start + 1).search(/\n {2}[\w-]+:/)
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + next)
})()

/** The `files:` block of the Create GitHub Release step, comments stripped. */
const releaseGlobs = (() => {
  const start = workflow.indexOf('          files: |')
  expect(start).toBeGreaterThan(-1)
  const rest = workflow.slice(start).split('\n').slice(1)
  const globs = []
  for (const line of rest) {
    if (!/^ {12}\S/.test(line)) break // the block ends at the next shallower key
    if (!line.trim().startsWith('#')) globs.push(line.trim())
  }
  return globs
})()

describe('every configured target reaches the release (HTOO-373)', () => {
  // suffix → the glob that must publish it. Keyed on what the artifact is
  // CALLED, because that is what both halves have to agree about: the left is
  // derived from electron-builder.yml's artifactName templates, the right is
  // what the workflow asks GitHub to upload.
  const EXPECTED = [
    { target: 'nsis', suffix: '-setup.exe' },
    { target: 'portable', suffix: '-portable.exe' },
    { target: 'AppImage', suffix: '.AppImage' },
    { target: 'deb', suffix: '.deb' },
    { target: 'dmg', suffix: '.dmg' }
  ]

  it('finds the release globs at all', () => {
    // Guards the parser above. A reindented `files:` block would leave every
    // assertion below comparing against an empty list, which is the one way a
    // test shaped like this passes while checking nothing.
    expect(releaseGlobs.length).toBeGreaterThanOrEqual(5)
  })

  it.each(EXPECTED)('$target is declared, and has a release glob', ({ target, suffix }) => {
    expect(builder).toMatch(new RegExp(`^\\s*(- )?(target: )?${target}\\s*$`, 'm'))
    expect(releaseGlobs.some((g) => g.endsWith(suffix))).toBe(true)
  })

  it('publishes nothing the configuration does not declare', () => {
    // The other direction, and it is not symmetry for its own sake. A glob with
    // no target behind it goes unmatched every release, which is a failure that
    // arrives on a tag — the most expensive moment to find one.
    const known = EXPECTED.map((e) => e.suffix)
    for (const glob of releaseGlobs) {
      expect(known.some((suffix) => glob.endsWith(suffix))).toBe(true)
    }
    expect(releaseGlobs).toHaveLength(EXPECTED.length)
  })

  it('leaves the Windows target list in electron-builder.yml alone', () => {
    // `--win` with no targets after it. Naming them here as well would put the
    // list in two files, which is the exact shape Taliesin's missing installer
    // came from: the config said two and the workflow said one, and the config
    // is the half a reader checks.
    expect(workflow).toMatch(/npx electron-builder --win --publish never/)
    expect(workflow).not.toMatch(/--win \w/)
  })

  it('signs every Windows artifact it publishes, or none of them', () => {
    // Signing one of the two would be worse than signing neither: a user handed
    // a signed installer beside an unsigned portable exe cannot read that as
    // "credentials are configured for one artifact". One step signs all of them
    // (HTOO-517), so the step must name each Windows target's resolved path, and
    // no other. The output name is the suffix without its dash and extension:
    // the Resolve Windows artifacts step writes `setup` and `portable`.
    const sign = step('Sign installer + portable exe')
    const named = new Set([...sign.matchAll(/steps\.artifact\.outputs\.(\w+)/g)].map((m) => m[1]))
    const windowsArtifacts = EXPECTED.filter((e) => e.suffix.endsWith('.exe'))
    expect(windowsArtifacts.length).toBeGreaterThanOrEqual(2)
    for (const { suffix } of windowsArtifacts) {
      expect(named.has(suffix.slice(1, -'.exe'.length))).toBe(true)
    }
    expect(named.size).toBe(windowsArtifacts.length)
  })

  it('uploads every Windows artifact out of the build job', () => {
    // The step between packaging and publishing, and the one the release job's
    // globs cannot speak for: `artifacts/**` can only match what was uploaded.
    // `if-no-files-found: error` then covers both names, so a rename in
    // electron-builder.yml fails the build rather than shipping one artifact.
    for (const { suffix } of EXPECTED.filter((e) => e.suffix.endsWith('.exe'))) {
      expect(workflow).toContain(`dist/*${suffix}`)
    }
  })

  it('verifies the fuses on every platform that packs an artifact', () => {
    // HTOO-374 runs per job because no job can see another's pack. Adding a
    // target to a platform that does not verify would ship an unverified
    // artifact, and that is invisible until someone reads the workflow.
    const verifySteps = workflow.match(/node scripts\/verify-fuses\.mjs/g) ?? []
    expect(verifySteps).toHaveLength(3)
  })

  it('installs per-user, assisted, with a directory page', () => {
    // Pinned because changing perMachine after a release is the expensive one:
    // an existing per-user installation is not upgraded by a per-machine
    // installer, and the user ends up with two. allowToChangeInstallationDirectory
    // only takes effect while oneClick is false, so the three are asserted
    // together rather than separately.
    expect(builder).toMatch(/^ {2}oneClick: false$/m)
    expect(builder).toMatch(/^ {2}perMachine: false$/m)
    expect(builder).toMatch(/^ {2}allowToChangeInstallationDirectory: true$/m)
  })
})

/**
 * The Windows signing shape (HTOO-517). It fails only on a tag, which is the most
 * expensive moment to find a fault, so the shape is pinned here.
 *
 * On 2026-09-30 SSL.com moved login.ssl.com to a chain that the JDK 11.0.2 in
 * CodeSignTool cannot build. Every sign through sslcom/esigner-codesign (which
 * runs that JDK) then failed with `PKIX path building failed`. The fix runs the
 * CodeSignTool jar on Temurin 17 and reads each signature back, because
 * CodeSignTool can fail and still exit 0. Ported from oghma's
 * release-signing.test.mjs. Like oghma, Creidhne signs with no `if:` guard on the
 * secrets, so a run without them fails and does not publish unsigned files.
 *
 * This checks the REQUEST, not the signed file. Only a tag run can sign.
 */
describe('Windows signing in release.yml (HTOO-517)', () => {
  it('runs CodeSignTool on Temurin 17, never on its bundled JDK', () => {
    expect(workflow).not.toMatch(/uses: sslcom\/esigner-codesign@/)
    expect(workflow).not.toMatch(/CodeSignTool\.bat|jdk-11/)
    expect(step('Set up Java 17 for CodeSignTool')).toMatch(
      /uses: actions\/setup-java@v5\n\s+with:\n\s+distribution: temurin\n\s+java-version: '17'/
    )
    const sign = step('Sign installer + portable exe')
    expect(sign).toContain("Join-Path $env:JAVA_HOME 'bin/java.exe'")
    expect(sign).toMatch(/CODESIGNTOOL_VERSION: '1\.3\.2'/)
  })

  it('runs the jar in its own folder, with an output folder', () => {
    // CodeSignTool reads conf/ from its working directory. With no
    // -output_dir_path it asks whether to replace the input, and that prompt
    // waits until the job times out.
    const sign = step('Sign installer + portable exe')
    expect(sign).toMatch(
      /Push-Location \$toolDir[\s\S]*-jar \$jar\.FullName sign[\s\S]*Pop-Location/
    )
    expect(sign).toContain('"-output_dir_path=$out"')
  })

  it('reads each signature back before the upload', () => {
    const sign = step('Sign installer + portable exe')
    expect(sign).toMatch(/foreach \(\$file in \$files\)[\s\S]*Get-AuthenticodeSignature \$file/)
    expect(sign).toContain("-ne 'Valid'")
  })

  it('signs unconditionally, so a run without the secrets fails', () => {
    expect(step('Set up Java 17 for CodeSignTool')).not.toMatch(/^\s+if:/m)
    expect(step('Sign installer + portable exe')).not.toMatch(/^\s+if:/m)
  })

  it('signs after the fuse check and before the upload, in build-windows', () => {
    const order = [
      '- name: Verify Electron fuses',
      '- name: Resolve Windows artifacts',
      '- name: Set up Java 17 for CodeSignTool',
      '- name: Sign installer + portable exe',
      '- name: Upload Windows artifacts'
    ].map((name) => windowsJob.indexOf(name))
    for (const at of order) expect(at).toBeGreaterThan(-1)
    for (let i = 1; i < order.length; i++) expect(order[i - 1]).toBeLessThan(order[i])
  })

  it('needs no Node 20 holdout', () => {
    // The env existed only for esigner-codesign (`using: node20`).
    expect(workflow).not.toMatch(/^\s*FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:/m)
  })
})
