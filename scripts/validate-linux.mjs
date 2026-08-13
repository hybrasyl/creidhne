#!/usr/bin/env node
/**
 * Run `npm run validate` on real Linux, from a Windows dev box, via WSL.
 *
 * This exists because GitHub Actions no longer runs a check on every push (see
 * `.github/workflows/ci.yml`), and Linux was the one thing the paid runners
 * covered that a Windows box cannot. WSL covers it for nothing.
 *
 * Repo-agnostic on purpose — it derives everything from `git rev-parse` and the
 * directory name, so the house Electron repos adopt it by copying the file.
 *
 * ## Why a second checkout, rather than running in place
 *
 * Two reasons, and the first is fatal on its own:
 *
 * 1. **`node_modules` cannot be shared.** It holds platform-native binaries —
 *    esbuild, rollup, electron itself — so a Linux `npm ci` over the Windows
 *    tree would overwrite them and break the Windows side until reinstalled.
 * 2. `/mnt/<drive>` is the 9p/drvfs bridge, and node's small-file access
 *    patterns are pathologically slow across it.
 *
 * So this clones into WSL's own ext4 and syncs it from the Windows repo. The
 * clone is a cache: delete it and the next run rebuilds it.
 *
 * **Windows will warn about cross-filesystem access the first time**, linking to
 * learn.microsoft.com/windows/wsl/filesystems. That warning is about exactly the
 * mistake this layout avoids. The only thing that ever crosses `/mnt` here is
 * **git object transfer** — one clone, then small incremental fetches. Installing
 * dependencies, compiling and running the suite all happen on ext4, which is
 * where the cost would otherwise be. The initial clone is the one slow moment
 * and it happens once per repo.
 *
 * Fetching from the Windows path rather than from GitHub is deliberate: it needs
 * no credentials for a private repo, works offline, and can validate a branch
 * that was never pushed.
 *
 * ## What it validates, stated because it is easy to assume otherwise
 *
 * **Committed state only — HEAD, not the working tree.** That is exactly right
 * for the pre-push gate this backs up, since HEAD is what a push sends. Run it
 * with uncommitted work in progress and that work is not what was checked.
 */
import { execFileSync, spawnSync } from 'child_process'
import { basename } from 'path'

/** Run a command on the Windows side, returning trimmed stdout. */
function host(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf-8' }).trim()
}

/** Run a bash command inside WSL, streaming output. Returns the exit code. */
function wsl(script, { quiet = false } = {}) {
  const res = spawnSync('wsl', ['-e', 'bash', '-lc', script], {
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf-8'
  })
  if (res.error) {
    console.error(`\nCould not run WSL: ${res.error.message}`)
    console.error('Install it with `wsl --install`, then re-run this.')
    process.exit(1)
  }
  return { code: res.status ?? 1, out: (res.stdout ?? '').trim() }
}

/** Single-quote a string for bash. */
function q(s) {
  return `'${String(s).replaceAll("'", `'\\''`)}'`
}

const root = host('git', ['rev-parse', '--show-toplevel'])
const head = host('git', ['rev-parse', 'HEAD'])
const name = basename(root)
// Under ~/.cache so it reads as disposable, and per-repo so several house apps
// can each keep one.
//
// The path is assembled INSIDE bash rather than interpolated as a quoted
// string, and that is a scar: `'$HOME/.cache/...'` is single-quoted, so bash
// never expands it and `mkdir -p` cheerfully creates a directory literally
// named `$HOME` in the current directory -- which was the Windows repo. It
// produced 787 MB of junk inside the working tree and a gitlink in the commit.
// `q()` exists to make a string safe, and safety here meant preventing the one
// expansion that had to happen.
const CACHE_DIR = '"$HOME/.cache/house-linux-validate"'
const destVar = `d=${CACHE_DIR}/${q(name)}`

// A missing node in WSL is the one failure worth catching by hand: the error it
// would otherwise produce is `npm: command not found` from inside a subshell,
// three layers down.
const probe = wsl('command -v node >/dev/null && node -v || echo MISSING', { quiet: true })
if (probe.out === 'MISSING' || probe.code !== 0) {
  console.error('\nWSL has no node. Install one inside WSL, for example:')
  console.error(
    '  wsl -e bash -lc "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs"'
  )
  process.exit(1)
}
console.log(`WSL node ${probe.out}`)

const src = wsl(`wslpath -a ${q(root)}`, { quiet: true }).out
console.log(`Validating ${name} @ ${head.slice(0, 8)} on Linux`)

// Clone once, then fetch. `--no-checkout` is not used: the working tree is what
// gets validated. Fetching from the Windows repo rather than the remote keeps
// this working offline and on a branch that was never pushed.
const sync = [
  `set -e`,
  destVar,
  `mkdir -p "$(dirname "$d")"`,
  `if [ ! -d "$d/.git" ]; then git clone -q ${q(src)} "$d"; fi`,
  `cd "$d"`,
  `git remote set-url origin ${q(src)}`,
  `git fetch -q origin`,
  // Detached at the exact commit: this mirrors what is about to be pushed, not
  // whatever branch the cache happened to be left on.
  `git checkout -q --detach ${q(head)}`,
  `git reset -q --hard ${q(head)}`,
  `git clean -qfd -e node_modules`
].join(' && ')

if (wsl(sync).code !== 0) {
  console.error('\nCould not sync the Linux checkout. Delete it and retry:')
  console.error(`  wsl -e bash -lc 'rm -rf ~/.cache/house-linux-validate/${name}'`)
  process.exit(1)
}

// `npm ci` is the slow part, so it runs only when the lockfile actually moved.
// The stamp lives beside node_modules and is deliberately not in git.
const install = [
  `set -e`,
  destVar,
  `cd "$d"`,
  `stamp=node_modules/.lockfile-sha`,
  `want=$(sha1sum package-lock.json | cut -d' ' -f1)`,
  `if [ ! -d node_modules ] || [ "$(cat $stamp 2>/dev/null)" != "$want" ]; then`,
  `  echo "npm ci (lockfile changed)"; npm ci; echo "$want" > $stamp;`,
  `else echo "dependencies up to date"; fi`
].join('\n')

if (wsl(install).code !== 0) process.exit(1)

const { code } = wsl(`${destVar}; cd "$d" && npm run validate`)
if (code === 0) console.log(`\nLinux validate passed (${name} @ ${head.slice(0, 8)})`)
process.exit(code)
