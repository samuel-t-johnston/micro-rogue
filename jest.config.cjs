module.exports = {
  // Test environment - simulate browser environment
  testEnvironment: 'jsdom',
  
  // File extensions to look for
  moduleFileExtensions: ['js', 'json'],
  
  // Transform ES6 modules for testing
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Module name mapping for ES6 imports
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    '*.js',
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.cjs',
    '!package*.json'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
}; 