import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
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
    plugins: { 'unused-imports': unusedImports, 'react-hooks': reactHooks },
    rules: {
      // The codebase already carries `eslint-disable react-hooks/exhaustive-deps`
      // comments; wire up the plugin so those resolve and real hook bugs surface.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // This codebase uses plain function components without PropTypes
      // (validation lives in the XSD/IPC layer, not runtime prop checks).
      'react/prop-types': 'off',
      // Literal quotes/apostrophes in help, reference, and calculator copy are
      // intentional and render fine; escaping them hurts readability.
      'react/no-unescaped-entities': 'off',
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
