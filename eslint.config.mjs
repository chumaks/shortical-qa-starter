// ESLint covers what a type-aware linter does best; project-specific rules
// live in scripts/rules.ts (npm run rules).
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'artifacts/', 'scripts/selftest-fixtures/'] },

  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A missing `await` is the most common way for a UI test to pass while
      // checking nothing: the assertion runs after the test has ended.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    files: ['web/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Fixed waits are handled by `npm run rules` (no-fixed-wait), which
      // accepts a documented `lint-allow` reason; one mechanism, not two.
      'playwright/no-wait-for-timeout': 'off',
      'playwright/missing-playwright-await': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'error',
      // Assertions in page objects (expect.poll in waits) are deliberate.
      'playwright/no-standalone-expect': 'off',
      'playwright/expect-expect': 'error',
    },
  },
);
