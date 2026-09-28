// https://docs.expo.dev/guides/using-eslint/
//
// eslint-config-expo carries eslint-plugin-react-hooks, which is the reason
// this exists: the compiler-aware rules (refs, purity, set-state-in-effect)
// catch the class of bug that survives a type check and only ever shows up as
// "why did that not update".
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Jest needs require() to re-import a module after mocking it: `import` is
    // hoisted, so it cannot see a jest.doMock that ran inside the test body.
    // These tests exist precisely to prove a module can be imported without
    // pulling in expo-notifications, and they cannot be written with import.
    files: ['**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
