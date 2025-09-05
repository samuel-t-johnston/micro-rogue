import { Character } from '../src/js/entities/character.js';

describe('Character', () => {
  let character;

  beforeEach(() => {
    character = new Character(3, 2, 4, 1, 5, '@', 5, 5, false);
  });

  describe('Constructor', () => {
    test('should create character with correct attributes', () => {
      expect(character.body).toBe(3);
      expect(character.mind).toBe(2);
      expect(character.agility).toBe(4);
      expect(character.control).toBe(1);
      expect(character.hpBonus).toBe(5);
      expect(character.symbol).toBe('@');
      expect(character.x).toBe(5);
      expect(character.y).toBe(5);
      expect(character.isPlayer).toBe(false);
    });

    test('should calculate max HP correctly', () => {
      // maxHp = (body * 2) + hpBonus = (3 * 2) + 5 = 11
      expect(character.maxHp).toBe(11);
      expect(character.currentHp).toBe(11);
    });

    test('should initialize with default values', () => {
      const defaultCharacter = new Character();
      expect(defaultCharacter.body).toBe(1);
      expect(defaultCharacter.mind).toBe(1);
      expect(defaultCharacter.agility).toBe(1);
      expect(defaultCharacter.control).toBe(1);
      expect(defaultCharacter.hpBonus).toBe(0);
      expect(defaultCharacter.symbol).toBe('@');
      expect(defaultCharacter.x).toBe(0);
      expect(defaultCharacter.y).toBe(0);
      expect(defaultCharacter.isPlayer).toBe(false);
      expect(defaultCharacter.maxHp).toBe(2); // (1 * 2) + 0
    });

    test('should initialize inventory and equipment', () => {
      expect(character.inventory).toEqual([]);
      expect(character.maxInventorySize).toBe(5);
      expect(character.equipment).toEqual({
        weapon1: null,
        weapon2: null,
        head: null,
        body: null,
        hands: null,
        legs: null,
        feet: null,
        neck: null,
        rings: new Array(10).fill(null),
      });
    });
  });

  describe('Health Management', () => {
    test('should calculate max HP correctly', () => {
      const newMaxHp = character.calculateMaxHp();
      expect(newMaxHp).toBe(11);
      expect(character.maxHp).toBe(11);
    });

    test('should heal character without exceeding max HP', () => {
      character.currentHp = 5;
      character.heal(3);
      expect(character.currentHp).toBe(8);

      character.heal(10); // Should not exceed maxHp
      expect(character.currentHp).toBe(11);
    });

    test('should take damage without going below 0', () => {
      character.takeDamage(5);
      expect(character.currentHp).toBe(6);

      character.takeDamage(10); // Should not go below 0
      expect(character.currentHp).toBe(0);
    });

    test('should check if character is alive', () => {
      expect(character.isAlive()).toBe(true);

      character.currentHp = 0;
      expect(character.isAlive()).toBe(false);

      character.currentHp = 1;
      expect(character.isAlive()).toBe(true);
    });

    test('should move character to new position', () => {
      expect(character.x).toBe(5);
      expect(character.y).toBe(5);
      
      character.moveTo(10, 15);
      
      expect(character.x).toBe(10);
      expect(character.y).toBe(15);
    });

    test('should create player character with isPlayer = true', () => {
      const playerCharacter = new Character(1, 1, 1, 1, 0, '@', 0, 0, true);
      expect(playerCharacter.isPlayer).toBe(true);
      expect(playerCharacter.symbol).toBe('@');
    });
  });

  describe('Inventory Management', () => {
    test('should add item to inventory when space available', () => {
      const item = { name: 'Sword', type: 'weapon' };
      const result = character.addToInventory(item);
      
      expect(result).toBe(true);
      expect(character.inventory).toHaveLength(1);
      expect(character.inventory[0]).toEqual(item);
    });

    test('should not add item when inventory is full', () => {
      // Fill inventory
      for (let i = 0; i < 5; i++) {
        character.addToInventory({ name: `Item ${i}`, type: 'misc' });
      }

      const newItem = { name: 'New Item', type: 'weapon' };
      const result = character.addToInventory(newItem);
      
      expect(result).toBe(false);
      expect(character.inventory).toHaveLength(5);
      expect(character.inventory).not.toContain(newItem);
    });

    test('should remove item from inventory by index', () => {
      const item1 = { name: 'Sword', type: 'weapon' };
      const item2 = { name: 'Shield', type: 'armor' };
      
      character.addToInventory(item1);
      character.addToInventory(item2);

      const removedItem = character.removeFromInventory(0);
      
      expect(removedItem).toEqual(item1);
      expect(character.inventory).toHaveLength(1);
      expect(character.inventory[0]).toEqual(item2);
    });

    test('should return null when removing from invalid index', () => {
      const result = character.removeFromInventory(0);
      expect(result).toBe(null);

      character.addToInventory({ name: 'Item', type: 'misc' });
      const result2 = character.removeFromInventory(5); // Invalid index
      expect(result2).toBe(null);
    });
  });

  describe('Equipment Management', () => {
    test('should equip item to valid slot', () => {
      const weapon = { name: 'Sword', type: 'weapon' };
      const result = character.equipItem(weapon, 'weapon1');
      
      expect(result).toBe(true);
      expect(character.equipment.weapon1).toEqual(weapon);
    });

    test('should equip ring to first available ring slot', () => {
      const ring = { name: 'Ring of Power', type: 'ring' };
      const result = character.equipItem(ring, 'rings');
      
      expect(result).toBe(true);
      expect(character.equipment.rings[0]).toEqual(ring);
      expect(character.equipment.rings[1]).toBe(null);
    });

    test('should not equip item to invalid slot', () => {
      const item = { name: 'Invalid Item', type: 'misc' };
      const result = character.equipItem(item, 'invalidSlot');
      
      expect(result).toBe(false);
      expect(character.equipment.invalidSlot).toBeUndefined();
    });

    test('should not equip ring when all ring slots are full', () => {
      // Fill all ring slots
      for (let i = 0; i < 10; i++) {
        character.equipItem({ name: `Ring ${i}`, type: 'ring' }, 'rings');
      }

      const newRing = { name: 'New Ring', type: 'ring' };
      const result = character.equipItem(newRing, 'rings');
      
      expect(result).toBe(false);
      expect(character.equipment.rings).not.toContain(newRing);
    });

    test('should unequip item from valid slot', () => {
      const weapon = { name: 'Sword', type: 'weapon' };
      character.equipItem(weapon, 'weapon1');
      
      const unequippedItem = character.unequipItem('weapon1');
      
      expect(unequippedItem).toEqual(weapon);
      expect(character.equipment.weapon1).toBe(null);
    });

    test('should unequip ring from specific ring slot', () => {
      const ring = { name: 'Ring of Power', type: 'ring' };
      character.equipItem(ring, 'rings');
      
      const unequippedRing = character.unequipItem('rings', 0);
      
      expect(unequippedRing).toBe(null); // Returns null when unequipping
      expect(character.equipment.rings[0]).toBe(null);
    });

    test('should return null when unequipping from invalid slot', () => {
      const result = character.unequipItem('invalidSlot');
      expect(result).toBe(null);
    });

    test('should return null when unequipping from invalid ring index', () => {
      const result = character.unequipItem('rings', 15); // Invalid index
      expect(result).toBe(null);
    });
  });
}); 