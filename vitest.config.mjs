import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The automatic JSX runtime, so a component test needs no `import React`. This is
  // esbuild's setting rather than `@vitejs/plugin-react`, which is already a devDep:
  // the plugin adds Babel and fast refresh to the transform, and neither does
  // anything for a test run.
  esbuild: { jsx: 'automatic' },
  test: {
    // `node` stays the default: almost every test here is a pure-function test over
    // main-process parsers, schemas and renderer helpers, and a DOM they never touch
    // is startup cost on all ~1400 of them. A component test opts in per file with a
    // `@vitest-environment jsdom` docblock (HTOO-144).
    environment: 'node',
    // `.test.jsx` is collected as well as `.test.js`, so a component test can be
    // written in JSX. A `.js` file holding JSX is not transformed, so without this a
    // component test either has to be written in `React.createElement` calls or is
    // silently never collected.
    include: ['src/**/__tests__/**/*.test.{js,jsx}', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      // Source extensions, not `src/**` (HTOO-127). A bare `src/**` sweeps in
      // index.html, the CSS, the webp and the JSON, and v8 then hands each to Rollup
      // to remap — which printed `Expression expected` on index.html every run. The
      // outcome was correct (an HTML file has no coverage to report, and it was
      // excluded), but a parse warning nobody can act on trains people to ignore
      // parse warnings.
      //
      // Naming the extensions pins the exclusion by construction rather than by a
      // deny-list that has to grow with every new asset type.
      //
      // Do NOT re-add `--coverage.include` to the `test:coverage` script: a CLI flag
      // OVERRIDES this, which is why the warning survived this setting for so long.
      // A brace glob would also be expanded by the shell before vitest saw it.
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/__tests__/**',
        // Release tooling, not app code — has its own unit test but shouldn't
        // count toward the logic-layer coverage thresholds below.
        'scripts/**',
        'src/preload/**',
        'src/renderer/src/main.jsx',
        // Glue / worker-thread / network I/O — exercised via integration + manual
        // QA, not unit tests. Excluded so the logic-layer thresholds below are
        // meaningful rather than dragged down by wiring.
        'src/main/index.js',
        'src/main/indexService.js',
        'src/main/indexWorker.js',
        'src/main/updateCheck.js'
      ],
      // Per-area thresholds lock in the well-tested logic layers (main parsers/
      // schemas/stores, asset-pack loader, renderer utils) so coverage there
      // can't silently regress. The UI layer (components/pages/hooks) is
      // intentionally not thresholded — it's validated by manual smoke tests.
      thresholds: {
        'src/main/**': { statements: 84, branches: 64, functions: 86, lines: 86 },
        'src/main/assetPacks/**': { statements: 84, branches: 76, functions: 64, lines: 86 },
        'src/renderer/src/utils/**': { statements: 87, branches: 72, functions: 90, lines: 90 }
      }
    }
  }
})
