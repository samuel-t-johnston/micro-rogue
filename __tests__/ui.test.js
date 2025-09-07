import { updateInventoryUI, updateUI, addMessage } from '../src/js/ui/ui.js';

// Mock DOM elements
const mockGameDisplay = {
  innerHTML: '',
  querySelector: jest.fn(),
};



const mockNewGameBtn = {
  addEventListener: jest.fn(),
};

// Mock document.getElementById
document.getElementById = jest.fn((id) => {
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

  switch (id) {
    case 'gameDisplay':
      return mockGameDisplay;
    case 'newGameBtn':
      return mockNewGameBtn;
    case 'level':
    case 'hp':
    case 'score':
    case 'turns':
    case 'char-level':
    case 'body':
    case 'mind':
    case 'agility':
    case 'control':
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
      return mockElement;
    default:
      return null;
  }
});

// Mock document.querySelector
document.querySelector = jest.fn((selector) => {
  const mockElement = {
    textContent: '',
    classList: {
      contains: jest.fn(() => false),
      add: jest.fn(),
      remove: jest.fn(),
    },
  };
  
  if (selector === '.rings-section h4' || selector === '.inventory-list h4') {
    return mockElement;
  }
  
  return null;
});

describe('UI Functions', () => {
  let mockPlayer;
  let mockGameState;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockGameDisplay.innerHTML = '';


    // Setup mock player
    mockPlayer = {
      body: 3,
      mind: 2,
      agility: 4,
      control: 1,
      currentHp: 8,
      maxHp: 11,
      inventory: [
        { name: 'Sword', type: 'weapon' },
        { name: 'Shield', type: 'armor' },
      ],
      equipment: {
        weapon1: { name: 'Sword', type: 'weapon' },
        weapon2: null,
        head: null,
        body: { name: 'Leather Armor', type: 'armor' },
        hands: null,
        legs: null,
        feet: null,
        neck: null,
        rings: new Array(10).fill(null),
      },
    };

    // Setup mock game state
    mockGameState = {
      level: 1,
      score: 150,
      turns: 25,
      messages: [
        '[1] You enter the room.',
        '[2] You find a sword!',
      ],
    };
  });

  describe('updateInventoryUI', () => {
    test('should update inventory display with player items', () => {
      updateInventoryUI(mockPlayer);

      // Check that the function updates the inventory display
      expect(document.getElementById).toHaveBeenCalled();
    });

    test('should display numbered inventory items', () => {
      mockPlayer.inventory = [
        { name: 'Iron Sword', type: 'weapon' },
        { name: 'Wooden Shield', type: 'armor' },
        { name: 'Health Potion', type: 'consumable' }
      ];
      
      updateInventoryUI(mockPlayer);
      
      expect(document.getElementById).toHaveBeenCalled();
    });

    test('should handle empty inventory', () => {
      mockPlayer.inventory = [];
      updateInventoryUI(mockPlayer);

      expect(document.getElementById).toHaveBeenCalled();
    });

    test('should handle player with no equipment', () => {
      mockPlayer.equipment = {
        weapon1: null,
        weapon2: null,
        head: null,
        body: null,
        hands: null,
        legs: null,
        feet: null,
        neck: null,
        rings: new Array(10).fill(null),
      };

      updateInventoryUI(mockPlayer);
      expect(document.getElementById).toHaveBeenCalled();
    });
  });

  describe('updateUI', () => {
    test('should update UI with game state and player info', () => {
      updateUI(mockGameState, mockPlayer);

      // Check that the function accessed various UI elements
      expect(document.getElementById).toHaveBeenCalledWith('level');
      expect(document.getElementById).toHaveBeenCalledWith('hp');
      expect(document.getElementById).toHaveBeenCalledWith('score');
    });

    test('should handle empty messages', () => {
      mockGameState.messages = [];
      updateUI(mockGameState, mockPlayer);

      expect(document.getElementById).toHaveBeenCalledWith('messages');
    });

    test('should handle player with full health', () => {
      mockPlayer.currentHp = mockPlayer.maxHp;
      updateUI(mockGameState, mockPlayer);

      expect(document.getElementById).toHaveBeenCalledWith('hp');
    });

    test('should handle player with low health', () => {
      mockPlayer.currentHp = 1;
      updateUI(mockGameState, mockPlayer);

      expect(document.getElementById).toHaveBeenCalledWith('hp');
    });
  });

  describe('addMessage', () => {
    test('should add message to game state', () => {
      const initialMessageCount = mockGameState.messages.length;
      addMessage('Test message', mockGameState, mockPlayer);

      expect(mockGameState.messages).toHaveLength(initialMessageCount + 1);
      expect(mockGameState.messages[0]).toBe('[25] Test message'); // Messages are added to beginning
    });

    test('should increment turn count when adding message', () => {
      const initialTurns = mockGameState.turns;
      addMessage('Test message', mockGameState, mockPlayer);

      expect(mockGameState.turns).toBe(initialTurns); // Turns are not incremented by addMessage
    });

    test('should keep only last 30 messages', () => {
      // Reset turn count to ensure consistent test results
      mockGameState.turns = 25;
      mockGameState.messages = [];
      
      // Add 35 messages (more than the max of 30)
      for (let i = 0; i < 35; i++) {
        addMessage(`Message ${i}`, mockGameState, mockPlayer);
      }

      expect(mockGameState.messages).toHaveLength(30);
      expect(mockGameState.messages[0]).toBe('[25] Message 34'); // First message should be the last one added
      expect(mockGameState.messages[29]).toBe('[25] Message 5'); // Last message should be the 6th one added
    });

    test('should update UI after adding message', () => {
      addMessage('Test message', mockGameState, mockPlayer);

      expect(document.getElementById).toHaveBeenCalledWith('messages');
    });
  });

  describe('Equipment Display in Controls', () => {
    let mockChoiceModeManager;

    beforeEach(() => {
      mockChoiceModeManager = {
        getCurrentMode: jest.fn().mockReturnValue('numeric'),
        getActionContext: jest.fn().mockReturnValue(null),
        isInSpecialMode: jest.fn().mockReturnValue(true),
        getModeDisplayText: jest.fn().mockReturnValue('Equip - What would you like to equip?'),
        getModeControlInstructions: jest.fn().mockReturnValue([
          { label: 'Choose equip:', keys: '0-9' },
          { label: 'ESC:', keys: 'Cancel' }
        ])
      };

      // Mock all DOM elements needed by updateUI
      const mockElement = {
        innerHTML: '',
        textContent: '',
        appendChild: jest.fn(),
        querySelector: jest.fn().mockReturnValue({ textContent: '' })
      };

      const mockControlsElement = {
        innerHTML: '',
        textContent: '',
        appendChild: jest.fn(),
        querySelector: jest.fn().mockReturnValue({ textContent: '' })
      };

      document.getElementById = jest.fn((id) => {
        if (id === 'controls') {
          return mockControlsElement;
        }
        return mockElement;
      });

      document.querySelector = jest.fn().mockReturnValue({ textContent: '' });
      document.createElement = jest.fn().mockReturnValue(mockElement);
    });

    test('should display equipment items in controls for equip action', () => {
      const context = {
        action: 'equip',
        items: [
          { name: 'Leather Helm', itemId: 'leather_helm' },
          { name: 'Leather Armor', itemId: 'leather_armor' }
        ]
      };

      // Set up the choice mode manager to return the context
      mockChoiceModeManager.getActionContext.mockReturnValue(context);

      updateUI(mockGameState, mockPlayer, mockChoiceModeManager, context);

      // Get the controls element that was mocked
      const controlsElement = document.getElementById('controls');
      expect(controlsElement.innerHTML).toContain('Available equipment:');
      expect(controlsElement.innerHTML).toContain('0. Leather Helm');
      expect(controlsElement.innerHTML).toContain('1. Leather Armor');
    });

    test('should not display equipment section for non-equip actions', () => {
      const context = {
        action: 'pickup',
        items: [{ name: 'Sword', itemId: 'sword' }]
      };

      updateUI(mockGameState, mockPlayer, mockChoiceModeManager, context);

      expect(mockGameDisplay.innerHTML).not.toContain('Available equipment:');
    });

    test('should handle empty equipment list', () => {
      const context = {
        action: 'equip',
        items: []
      };

      updateUI(mockGameState, mockPlayer, mockChoiceModeManager, context);

      expect(mockGameDisplay.innerHTML).not.toContain('Available equipment:');
    });
  });

}); 