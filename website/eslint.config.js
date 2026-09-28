// Held to the same standard as the app, which uses eslint-config-expo. The
// rule that matters on both sides is react-hooks: the compiler-aware rules
// catch stale closures and impure renders, which is the class of bug that
// survives a type check and only shows up as "why did that not update".
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Unused imports are dead weight in a bundle that ships to a browser,
      // but an argument kept for signature shape is not a mistake.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
