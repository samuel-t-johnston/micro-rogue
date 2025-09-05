// Character class for reusable character logic
export class Character {
  constructor(body = 1, mind = 1, agility = 1, control = 1, hpBonus = 0, symbol = '@') {
    this.body = body;
    this.mind = mind;
    this.agility = agility;
    this.control = control;
    this.hpBonus = hpBonus;
    this.symbol = symbol;
    this.maxHp = this.body * 2 + this.hpBonus;
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

  // Calculate max HP based on body and bonus
  calculateMaxHp() {
    this.maxHp = this.body * 2 + this.hpBonus;
    return this.maxHp;
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
        return (this.equipment.rings[ringIndex] = null);
      }
    } else if (Object.prototype.hasOwnProperty.call(this.equipment, slot)) {
      const item = this.equipment[slot];
      this.equipment[slot] = null;
      return item;
    }
    return null;
  }
}
