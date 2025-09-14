import { CONFIG_SETTINGS } from '../utils/config.js';

const MAX_MESSAGES = CONFIG_SETTINGS.maxMessages;

// UI management functions
export function updateInventoryUI(player) {
  // Update equipment slots
  const equipmentSlots = [
    'weapon1',
    'weapon2',
    'head',
    'body',
    'hands',
    'legs',
    'feet',
    'neck',
  ];
  equipmentSlots.forEach(slot => {
    const slotElement = document.getElementById(`${slot}-slot`);
    const item = player.equipment[slot];
    slotElement.textContent = item ? item.name || '?' : '-';
  });

  // Update rings
  const ringsGrid = document.getElementById('rings-grid');
  ringsGrid.innerHTML = '';
  for (let i = 0; i < player.equipment.rings.length; i++) {
    const ringSlot = document.createElement('div');
    ringSlot.className = 'ring-slot';
    ringSlot.textContent = player.equipment.rings[i] ? '●' : '○';
    ringsGrid.appendChild(ringSlot);
  }

  // Update rings count
  const ringsCount = player.equipment.rings.filter(
    ring => ring !== null
  ).length;
  document.querySelector('.rings-section h4').textContent =
    `Rings (${ringsCount}/10)`;

  // Update inventory
  const inventoryItems = document.getElementById('inventory-items');
  inventoryItems.innerHTML = '';
  player.inventory.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'inventory-item';
    itemElement.textContent = `${index + 1}. ${item.name || 'Unknown Item'}`;
    inventoryItems.appendChild(itemElement);
  });

  // Update inventory count
  document.querySelector('.inventory-list h4').textContent =
    `Inventory (${player.inventory.length}/${player.maxInventorySize})`;
}

export function updateAttributesUI(player) {
  // Check if attributes tab elements exist (for test environment compatibility)
  const bodyBaseElement = document.getElementById('attr-body-base');
  if (!bodyBaseElement) {
    return; // Skip attributes update if elements don't exist (e.g., in tests)
  }

  // Check if player has the required stat structure (for test environment compatibility)
  if (!player.baseStats || !player.bonusedStats) {
    return; // Skip attributes update if player doesn't have stat structure (e.g., in tests)
  }

  // Update core stats
  document.getElementById('attr-body-base').textContent = player.baseStats.body;
  document.getElementById('attr-body-modified').textContent = player.bonusedStats.body;
  document.getElementById('attr-mind-base').textContent = player.baseStats.mind;
  document.getElementById('attr-mind-modified').textContent = player.bonusedStats.mind;
  document.getElementById('attr-agility-base').textContent = player.baseStats.agility;
  document.getElementById('attr-agility-modified').textContent = player.bonusedStats.agility;
  document.getElementById('attr-control-base').textContent = player.baseStats.control;
  document.getElementById('attr-control-modified').textContent = player.bonusedStats.control;

  // Update derived stats
  const baseMaxHp = player.baseStats.body * 2 + player.baseStats.hpBonus;
  const modifiedMaxHp = player.maxHp;
  document.getElementById('attr-maxhp-base').textContent = baseMaxHp;
  document.getElementById('attr-maxhp-modified').textContent = modifiedMaxHp;
  document.getElementById('attr-hp-current').textContent = player.currentHp;

  const baseMaxGuard = player.baseStats.agility * 2 + player.baseStats.guard;
  const modifiedMaxGuard = player.maxGuard;
  document.getElementById('attr-maxguard-base').textContent = baseMaxGuard;
  document.getElementById('attr-maxguard-modified').textContent = modifiedMaxGuard;
  document.getElementById('attr-guard-current').textContent = player.bonusedStats.guard;

  // Update combat stats
  document.getElementById('attr-attack-base').textContent = player.baseStats.attack;
  document.getElementById('attr-attack-modified').textContent = player.bonusedStats.attack;

  // Update effects list
  updateEffectsList(player);
}

function updateEffectsList(player) {
  const effectsList = document.getElementById('effects-list');
  if (!effectsList) {
    return; // Skip effects update if element doesn't exist (e.g., in tests)
  }
  
  effectsList.innerHTML = '';

  if (player.effects.length === 0) {
    const noEffectsRow = document.createElement('div');
    noEffectsRow.className = 'effect-row';
    noEffectsRow.innerHTML = '<span class="effect-name">No active effects</span>';
    effectsList.appendChild(noEffectsRow);
    return;
  }

  // Sort effects by source for consistent display
  const sortedEffects = [...player.effects].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    return a.type.localeCompare(b.type);
  });

  sortedEffects.forEach(effect => {
    const effectRow = document.createElement('div');
    effectRow.className = 'effect-row';

    // Format effect name
    const effectName = effect.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Format effect values
    const effectValues = effect.value ? `+${effect.value}` : '--';

    // Format effect category
    const effectCategory = effect.category || 'unknown';

    // Format effect source
    let effectSource = effect.source || 'unknown';
    if (effectSource.startsWith('equipment(')) {
      // Extract slot from "equipment(weapon1)" format
      const slot = effectSource.replace('equipment(', '').replace(')', '');
      const equippedItem = player.equipment[slot];
      effectSource = equippedItem ? equippedItem.name : `${slot} slot`;
    } else if (effectSource.startsWith('creature(')) {
      // Extract creature name from "creature(spider)" format
      const creature = effectSource.replace('creature(', '').replace(')', '');
      effectSource = creature.charAt(0).toUpperCase() + creature.slice(1);
    }

    // Format duration
    const duration = effect.turns !== null ? `${effect.turns} turns` : '--';

    effectRow.innerHTML = `
      <span class="effect-name">${effectName}</span>
      <span class="effect-values">${effectValues}</span>
      <span class="effect-category">${effectCategory}</span>
      <span class="effect-source">${effectSource}</span>
      <span class="effect-duration">${duration}</span>
    `;

    effectsList.appendChild(effectRow);
  });
}

export function updateControlsUI(choiceModeManager) {
  const controlsElement = document.getElementById('controls');

  if (choiceModeManager.isInSpecialMode()) {
    // Get display text and control instructions from the current mode
    const displayText = choiceModeManager.getModeDisplayText();
    const controlInstructions = choiceModeManager.getModeControlInstructions();
    const context = choiceModeManager.getActionContext();
    
    if (displayText) {
      // Build the controls HTML using the mode's display text and instructions
      let controlsHTML = `
        <h3>Controls</h3>
        <div class="control-mode">
          <strong>${displayText}</strong>
      `;
      
      // Add control instructions from the mode
      controlInstructions.forEach(instruction => {
        controlsHTML += `
          <div class="control-group">
            <strong>${instruction.label}</strong> ${instruction.keys}
          </div>
        `;
      });
      
      // Add context-specific information if available
      //TODO: Find a better way to handle injecting context-specific information into the controls HTML.
      if (context && context.action === 'pickup' && context.items) {
        controlsHTML += '<div class="control-group"><strong>Available items:</strong></div>';
        context.items.forEach((item, index) => {
          if (item.source === 'ground') {
            controlsHTML += `<div class="control-group">${index}. ${item.name}</div>`;
          } else if (item.source === 'container') {
            controlsHTML += `<div class="control-group">${index}. ${item.name} (${item.containerName})</div>`;
          }
        });
      } else if (context && context.action === 'equip' && context.items) {
        controlsHTML += '<div class="control-group"><strong>Available equipment:</strong></div>';
        context.items.forEach((item, index) => {
          controlsHTML += `<div class="control-group">${index}. ${item.name}</div>`;
        });
      } else if (context && context.action === 'weapon_replace' && context.weapons) {
        controlsHTML += '<div class="control-group"><strong>Equipped weapons:</strong></div>';
        context.weapons.forEach((weapon, index) => {
          controlsHTML += `<div class="control-group">${index}. ${weapon.item.name} (${weapon.slot})</div>`;
        });
      } else if (context && context.action === 'remove' && context.items) {
        controlsHTML += '<div class="control-group"><strong>Equipped items:</strong></div>';
        context.items.forEach((equipment, index) => {
          const slotName = equipment.slot === 'rings' ? `ring${equipment.ringIndex + 1}` : equipment.slot;
          controlsHTML += `<div class="control-group">${index}. ${equipment.item.name} (${slotName})</div>`;
        });
      } else if (context && context.action === 'drop' && context.items) {
        controlsHTML += '<div class="control-group"><strong>Inventory items:</strong></div>';
        context.items.forEach((item, index) => {
          controlsHTML += `<div class="control-group">${index}. ${item.name}</div>`;
        });
      } else if (context && context.action === 'consume' && context.items) {
        controlsHTML += '<div class="control-group"><strong>Consumable items:</strong></div>';
        context.items.forEach((item, index) => {
          controlsHTML += `<div class="control-group">${index}. ${item.name}</div>`;
        });
      }
      
      controlsHTML += '</div>';
      controlsElement.innerHTML = controlsHTML;
    }
  } else {
    // Get display text and control instructions from default mode
    const displayText = choiceModeManager.getModeDisplayText();
    const controlInstructions = choiceModeManager.getModeControlInstructions();
    
    if (displayText) {
      // Build the controls HTML using the default mode's display text and instructions
      let controlsHTML = `
        <h3>Controls</h3>
        <div class="control-mode">
          <strong>${displayText}</strong>
      `;
      
      // Add control instructions from the default mode
      controlInstructions.forEach(instruction => {
        controlsHTML += `
          <div class="control-group">
            <strong>${instruction.label}</strong> ${instruction.keys}
          </div>
        `;
      });
      
      controlsHTML += '</div>';
      controlsElement.innerHTML = controlsHTML;
    }
  }
}

export function updateUI(gameState, player, choiceModeManager = null) {
  document.getElementById('level').textContent = gameState.level;
  document.getElementById('hp').textContent =
    `${player.currentHp}/${player.maxHp}`;
  document.getElementById('score').textContent = gameState.score;
  document.getElementById('turns').textContent = gameState.turns;

  // Update character attributes
  document.getElementById('char-level').textContent = player.level || 1;
  document.getElementById('body').textContent = player.bonusedStats.body;
  document.getElementById('mind').textContent = player.bonusedStats.mind;
  document.getElementById('agility').textContent = player.bonusedStats.agility;
  document.getElementById('control').textContent = player.bonusedStats.control;
  document.getElementById('guard').textContent = player.bonusedStats.guard;
  document.getElementById('attack').textContent = player.bonusedStats.attack;

  // Update inventory and equipment
  updateInventoryUI(player);

  // Update attributes tab
  updateAttributesUI(player);

  // Update controls if choice mode manager is provided
  if (choiceModeManager) {
    updateControlsUI(choiceModeManager);
  }

  // Update messages
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = '';
  gameState.messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
  });

  // Scroll to top to show latest message
  messagesContainer.scrollTop = 0;
}

export function addMessage(message, gameState, player) {
  const turnNumber = gameState.turns;
  const messageWithTurn = `[${turnNumber}] ${message}`;
  gameState.messages.unshift(messageWithTurn); // Add to beginning instead of end
  if (gameState.messages.length > MAX_MESSAGES) {
    gameState.messages.pop(); // Remove from end instead of beginning
  }
  updateUI(gameState, player);
}

// Initialize UI event handlers
export function initUI() {
  // Initialize hamburger menu
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const menuOverlay = document.getElementById('menu-overlay');
  const newGameMenuItem = document.getElementById('new-game-menu-item');

  if (hamburgerMenu && menuOverlay) {
    // Toggle menu
    hamburgerMenu.addEventListener('click', () => {
      menuOverlay.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', e => {
      if (
        !hamburgerMenu.contains(e.target) &&
        !menuOverlay.contains(e.target)
      ) {
        menuOverlay.classList.remove('active');
      }
    });

    // New Game menu item
    if (newGameMenuItem) {
      newGameMenuItem.addEventListener('click', () => {
        // Trigger new game action
        const event = new CustomEvent('newGameRequested');
        document.dispatchEvent(event);
        menuOverlay.classList.remove('active');
      });
    }

    // Save Game menu item
    const saveGameMenuItem = document.getElementById('save-game-menu-item');
    if (saveGameMenuItem) {
      saveGameMenuItem.addEventListener('click', () => {
        // Trigger save game action
        const event = new CustomEvent('saveGameRequested');
        document.dispatchEvent(event);
        menuOverlay.classList.remove('active');
      });
    }

    // Load Game menu item
    const loadGameMenuItem = document.getElementById('load-game-menu-item');
    if (loadGameMenuItem) {
      loadGameMenuItem.addEventListener('click', () => {
        // Trigger load game action
        const event = new CustomEvent('loadGameRequested');
        document.dispatchEvent(event);
        menuOverlay.classList.remove('active');
      });
    }

    // Delete Save Data menu item
    const deleteSaveMenuItem = document.getElementById('delete-save-menu-item');
    if (deleteSaveMenuItem) {
      deleteSaveMenuItem.addEventListener('click', () => {
        // Trigger delete save action
        const event = new CustomEvent('deleteSaveRequested');
        document.dispatchEvent(event);
        menuOverlay.classList.remove('active');
      });
    }
  }

  // Initialize tab switching
  initTabs();
}

// Update menu state based on save data availability
export function updateMenuState(hasSaveData) {
  const loadGameMenuItem = document.getElementById('load-game-menu-item');
  const deleteSaveMenuItem = document.getElementById('delete-save-menu-item');
  
  if (loadGameMenuItem) {
    if (hasSaveData) {
      loadGameMenuItem.style.display = 'block';
      loadGameMenuItem.style.opacity = '1';
      loadGameMenuItem.style.pointerEvents = 'auto';
    } else {
      loadGameMenuItem.style.display = 'block';
      loadGameMenuItem.style.opacity = '0.5';
      loadGameMenuItem.style.pointerEvents = 'none';
    }
  }
  
  if (deleteSaveMenuItem) {
    if (hasSaveData) {
      deleteSaveMenuItem.style.display = 'block';
      deleteSaveMenuItem.style.opacity = '1';
      deleteSaveMenuItem.style.pointerEvents = 'auto';
    } else {
      deleteSaveMenuItem.style.display = 'none';
    }
  }
}

// Initialize tab switching functionality
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remove active class from all buttons and panels
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      
      // Add active class to clicked button and corresponding panel
      button.classList.add('active');
      const targetPanel = document.getElementById(`${targetTab}-tab`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}
