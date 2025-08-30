module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off', // Allow console.log for debugging
    'prefer-const': 'error',
    'no-var': 'error',
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'warn',
    'no-empty': 'warn',
    'no-extra-semi': 'error',
    'no-irregular-whitespace': 'error',
    'no-unexpected-multiline': 'error'
  }
}; 