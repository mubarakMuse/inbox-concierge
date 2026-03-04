import js from '@eslint/js';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { 'react-refresh': reactRefresh, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaVersion: 2024, sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        document: 'readonly',
        window: 'readonly',
        TextDecoder: 'readonly',
        URLSearchParams: 'readonly',
        alert: 'readonly',
      },
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
