import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Not linted (node_modules is ignored by default).
  {
    ignores: ['assets/**', 'icons/**', 'sprite-previews/**'],
  },

  js.configs.recommended,

  // Project-wide rule tweaks.
  {
    rules: {
      // Handlers, stages, and seams (e.g. onDeath, stage `run`, effect handlers) deliberately keep a
      // full shared signature without using every parameter, so unused *args* aren't flagged. Unused
      // variables and imports still are — that's where the real dead-code value is.
      'no-unused-vars': [
        'error',
        { args: 'none', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Browser ES modules: game source, tests (happy-dom), and browser-loaded data.
  {
    files: ['src/**/*.js', 'data/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },

  // Node ES modules: dev scripts, config files.
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Service worker: runs in the ServiceWorkerGlobalScope, not the page.
  {
    files: ['service-worker.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.serviceworker },
    },
  },

  // JSDoc: enforce presence and well-formedness on the source surface, not tests.
  // Tags (@param/@returns) stay by-judgment — see docs/design/jsdoc-conventions.md.
  {
    files: ['src/**/*.js'],
    ignores: ['src/**/*.test.js'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: false },
        },
      ],
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/no-undefined-types': 'warn',
      // Off by design: tags are added by judgment, and terse self-evident tags
      // (`@param {string[]} names`, `@returns {number}`) are intentional — forcing a
      // description would just restate the type, the anti-pattern the conventions doc warns against.
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
    },
  },

  // Must come last: turns off stylistic rules that would conflict with Prettier.
  prettier,
];
