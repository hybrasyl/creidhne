import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.js'),
          indexWorker: resolve('src/main/indexWorker.js')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    base: './', // Ensure the base URL is relative
    // No publicDir. Pointing it at resources/ copied that whole tree into
    // out/renderer AND electron-builder ships resources/ too, so every asset
    // double-shipped (the 1.8MB logo master among them). The renderer's logo is
    // now a hashed import from src/renderer/src/assets/; the splash + window
    // icon are loaded by the main process from the packaged resources/.
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      include: ['react-window']
    },
    build: {
      outDir: 'out/renderer', // Output directory for your renderer build
      rollupOptions: {
        external: []
      }
    }
  }
})
