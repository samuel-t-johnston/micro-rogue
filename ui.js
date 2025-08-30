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

export function updateControlsUI(choiceModeManager) {
  const controlsElement = document.getElementById('controls');
  
  if (choiceModeManager.isInSpecialMode()) {
    const currentMode = choiceModeManager.getCurrentMode();
    const context = choiceModeManager.getActionContext();
    
    if (currentMode === 'directional') {
      controlsElement.innerHTML = `
        <h3>Controls</h3>
        <div class="control-mode">
          <strong>Use - What would you like to use?</strong>
          <div class="control-group">
            <strong>Choose direction:</strong> WASD, QEZC, or Arrow Keys
          </div>
          <div class="control-group">
            <strong>ESC:</strong> Cancel
          </div>
        </div>
      `;
    } else if (currentMode === 'numeric' && context && context.action === 'pickup') {
      // Build the item list for numeric mode
      let itemList = '';
      if (context.items && context.items.length > 0) {
        context.items.forEach((item, index) => {
          if (item.source === 'ground') {
            itemList += `<div class="control-group">${index}. ${item.name}</div>`;
          } else if (item.source === 'container') {
            itemList += `<div class="control-group">${index}. ${item.name} (${item.containerName})</div>`;
          }
        });
      }
      
      controlsElement.innerHTML = `
        <h3>Controls</h3>
        <div class="control-mode">
          <strong>Pick up - What would you like to pick up?</strong>
          ${itemList}
          <div class="control-group">
            <strong>Choose item:</strong> 0-9
          </div>
          <div class="control-group">
            <strong>ESC:</strong> Cancel
          </div>
        </div>
      `;
    }
  } else {
    // Default controls
    controlsElement.innerHTML = `
      <h3>Controls</h3>
      <div class="control-group">
        <strong>Movement:</strong> WASD or Arrow Keys
      </div>
      <div class="control-group">
        <strong>P:</strong> Pick up
      </div>
      <div class="control-group">
        <strong>U:</strong> Use something nearby
      </div>
    `;
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
  document.getElementById('body').textContent = player.body;
  document.getElementById('mind').textContent = player.mind;
  document.getElementById('agility').textContent = player.agility;
  document.getElementById('control').textContent = player.control;

  // Update inventory and equipment
  updateInventoryUI(player);

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
  if (gameState.messages.length > 10) {
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
    document.addEventListener('click', (e) => {
      if (!hamburgerMenu.contains(e.target) && !menuOverlay.contains(e.target)) {
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
  }
}


