import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
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
