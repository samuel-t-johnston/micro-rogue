import { StatBlock } from './statBlock.js';

// Character class for reusable character logic
export class Character {
  constructor(body = 1, mind = 1, agility = 1, control = 1, hpBonus = 0, symbol = '@', x = 0, y = 0, isPlayer = false, guard = 0, attack = 0) {
    // Base stats (separate from bonuses)
    this.baseStats = new StatBlock(body, mind, agility, control, hpBonus, guard, attack);
    
    // Bonused stats (calculated from base + effects)
    this.bonusedStats = this.baseStats.clone();
    
    this.symbol = symbol;
    this.x = x;
    this.y = y;
    this.isPlayer = isPlayer;
    
    // Effect tracking
    this.effects = [];
    
    this.maxHp = this.bonusedStats.body * 2 + this.bonusedStats.hpBonus;
    this.maxGuard = this.bonusedStats.agility * 2 + this.bonusedStats.guard;
    this.currentHp = this.maxHp;

    // Inventory system
    this.inventory = [];
    this.maxInventorySize = 5;

    // Equipment slots
    this.equipment = {
      weapon1: null,
      weapon2: null,
      head: null,
      body: null,
      hands: null,
      legs: null,
      feet: null,
      neck: null,
      rings: new Array(10).fill(null), // 10 ring slots
    };
  }

  // Calculate max HP based on bonused stats
  calculateMaxHp() {
    this.maxHp = this.bonusedStats.body * 2 + this.bonusedStats.hpBonus;
    return this.maxHp;
  }

  // Calculate max Guard based on bonused stats
  calculateMaxGuard() {
    this.maxGuard = this.bonusedStats.agility * 2 + this.bonusedStats.guard;
    return this.maxGuard;
  }

  // Heal character (won't exceed max HP)
  heal(amount) {
    this.currentHp = Math.min(this.currentHp + amount, this.maxHp);
  }

  // Damage character
  takeDamage(amount) {
    this.currentHp = Math.max(this.currentHp - amount, 0);
  }

  // Check if character is alive
  isAlive() {
    return this.currentHp > 0;
  }

  // Move character to new position
  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  // Add item to inventory
  addToInventory(item) {
    if (this.inventory.length < this.maxInventorySize) {
      this.inventory.push(item);
      return true;
    }
    return false; // Inventory full
  }

  // Check if inventory has space for another item
  canAddToInventory() {
    return this.inventory.length < this.maxInventorySize;
  }

  // Remove item from inventory
  removeFromInventory(itemIndex) {
    if (itemIndex >= 0 && itemIndex < this.inventory.length) {
      return this.inventory.splice(itemIndex, 1)[0];
    }
    return null;
  }

  // Equip item
  equipItem(item, slot) {
    if (slot === 'rings') {
      // Find first empty ring slot
      const ringIndex = this.equipment.rings.findIndex(ring => ring === null);
      if (ringIndex !== -1) {
        this.equipment.rings[ringIndex] = item;
        return true;
      }
    } else if (Object.prototype.hasOwnProperty.call(this.equipment, slot)) {
      this.equipment[slot] = item;
      return true;
    }
    return false;
  }

  // Unequip item
  unequipItem(slot, ringIndex = null) {
    if (slot === 'rings' && ringIndex !== null) {
      if (ringIndex >= 0 && ringIndex < this.equipment.rings.length) {
        const item = this.equipment.rings[ringIndex];
        this.equipment.rings[ringIndex] = null;
        return item;
      }
    } else if (Object.prototype.hasOwnProperty.call(this.equipment, slot)) {
      const item = this.equipment[slot];
      this.equipment[slot] = null;
      return item;
    }
    return null;
  }

  // Get all equipped items with their slots
  getEquippedItems() {
    const equippedItems = [];
    
    // Check all equipment slots
    for (const [slot, item] of Object.entries(this.equipment)) {
      if (item !== null) {
        if (slot === 'rings') {
          // Handle rings array
          this.equipment.rings.forEach((ring, index) => {
            if (ring !== null) {
              equippedItems.push({
                item: ring,
                slot: 'rings',
                ringIndex: index
              });
            }
          });
        } else {
          // Regular equipment slots
          equippedItems.push({
            item: item,
            slot: slot,
            ringIndex: null
          });
        }
      }
    }
    
    return equippedItems;
  }

  // Effect management methods
  
  /**
   * Add an effect to the character
   * @param {Object} effect - The effect object to add
   */
  addEffect(effect) {
    this.effects.push(effect);
    this.recalculateStats();
  }
  
  /**
   * Remove an effect from the character by type and source
   * @param {string} type - The effect type to remove
   * @param {string} source - The source of the effect to remove
   */
  removeEffect(type, source) {
    // Find the effect to remove
    const effectToRemove = this.effects.find(effect => 
      effect.type === type && effect.source === source
    );
    
    if (effectToRemove) {
      // Call removeFrom on the effect before removing it
      effectToRemove.removeFrom(this);
      
      // Remove the effect from the list
      this.effects = this.effects.filter(effect => 
        !(effect.type === type && effect.source === source)
      );
      
      // Recalculate stats
      this.recalculateStats();
    }
  }
  
  /**
   * Recalculate all stats by applying effects to base stats
   */
  recalculateStats() {
    // Reset to base stats
    this.bonusedStats = this.baseStats.clone();
    
    // Apply all effects using their applyTo method
    for (const effect of this.effects) {
      effect.applyTo(this);
    }
    
    // Recalculate derived stats
    this.calculateMaxHp();
    this.calculateMaxGuard();
    if (this.currentHp > this.maxHp) {
      this.currentHp = this.maxHp;
    }
  }
  
  /**
   * Process each-turn effects (called at the start of each turn)
   */
  processEffects() {
    // Process each-turn effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      
      // Process each-turn effects using the effect's eachTurn method
      const shouldContinue = effect.eachTurn(this);
      if (!shouldContinue) {
        // Effect should be removed
        this.effects.splice(i, 1);
      }
    }
    
    this.recalculateStats();
  }
  
  /**
   * Get all active effects
   * @returns {Array} - Array of active effects
   */
  getActiveEffects() {
    return [...this.effects];
  }
  
  /**
   * Get effects by category
   * @param {string} category - The category to filter by
   * @returns {Array} - Array of effects in the specified category
   */
  getEffectsByCategory(category) {
    return this.effects.filter(effect => effect.category === category);
  }
}
