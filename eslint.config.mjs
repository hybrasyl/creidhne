import reactPlugin from 'eslint-plugin-react'
import unusedImports from 'eslint-plugin-unused-imports'
import electronToolkit from '@electron-toolkit/eslint-config'
import electronToolkitPrettier from '@electron-toolkit/eslint-config-prettier'

export default [
  { ignores: ['node_modules/**', 'dist/**', 'out/**'] },
  { files: ['**/*.{js,jsx,mjs,cjs}'] },
  electronToolkit,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  { settings: { react: { version: 'detect' } } },
  electronToolkitPrettier,
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // This codebase uses plain function components without PropTypes
      // (validation lives in the XSD/IPC layer, not runtime prop checks).
      'react/prop-types': 'off',
      // Delegate unused-import handling to unused-imports (auto-fixable, and
      // removes the dead `import React` left over from the classic JSX runtime).
      // Real unused locals still warn.
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
      ]
    }
  }
]
