// Mock DOM elements that our game uses
global.document = {
  getElementById: jest.fn((id) => {
    const mockElement = {
      innerHTML: '',
      textContent: '',
      style: {},
      classList: {
        contains: jest.fn(() => false),
        add: jest.fn(),
        remove: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
    };
    
    // Return different mock elements based on ID
    switch (id) {
      case 'gameDisplay':
        mockElement.innerHTML = '';
        break;

      case 'newGameBtn':
        mockElement.addEventListener = jest.fn();
        break;
      case 'level':
      case 'hp':
      case 'score':
      case 'turns':
      case 'weapon1-slot':
      case 'weapon2-slot':
      case 'head-slot':
      case 'body-slot':
      case 'hands-slot':
      case 'legs-slot':
      case 'feet-slot':
      case 'neck-slot':
      case 'rings-grid':
      case 'inventory-items':
      case 'messages':
        mockElement.textContent = '';
        break;
      default:
        // For any other ID, return a mock element
        break;
    }
    
    return mockElement;
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  createElement: jest.fn((tag) => ({
    tagName: tag.toUpperCase(),
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      contains: jest.fn(() => false),
      add: jest.fn(),
      remove: jest.fn(),
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  })),
  querySelector: jest.fn((selector) => {
    if (selector === '.toggle-icon') {
      return {
        textContent: '▼',
        addEventListener: jest.fn(),
      };
    }
    if (selector === '.inventory-content') {
      return {
        classList: {
          contains: jest.fn(() => false),
          add: jest.fn(),
          remove: jest.fn(),
        },
      };
    }
    return null;
  }),
};

// Mock window object
global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  location: {
    href: 'http://localhost:8000',
  },
  console: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
};

// Mock fetch for loading JSON files
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock Math.random for predictable tests
const originalRandom = Math.random;
beforeEach(() => {
  Math.random = jest.fn(() => 0.5);
});

afterEach(() => {
  Math.random = originalRandom;
}); 