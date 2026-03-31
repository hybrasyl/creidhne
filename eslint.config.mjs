import reactPlugin from 'eslint-plugin-react'
import electronToolkit from '@electron-toolkit/eslint-config'
import electronToolkitPrettier from '@electron-toolkit/eslint-config-prettier'

export default [
  { ignores: ['node_modules/**', 'dist/**', 'out/**'] },
  { files: ['**/*.{js,jsx,mjs,cjs}'] },
  electronToolkit,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  { settings: { react: { version: 'detect' } } },
  electronToolkitPrettier
]
