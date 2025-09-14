import { StatBlock } from '../src/js/entities/statBlock.js';

describe('StatBlock', () => {
  describe('Constructor', () => {
    test('should create StatBlock with default values', () => {
      const stats = new StatBlock();
      expect(stats.body).toBe(1);
      expect(stats.mind).toBe(1);
      expect(stats.agility).toBe(1);
      expect(stats.control).toBe(1);
      expect(stats.hpBonus).toBe(0);
    });

    test('should create StatBlock with custom values', () => {
      const stats = new StatBlock(5, 3, 7, 2, 10);
      expect(stats.body).toBe(5);
      expect(stats.mind).toBe(3);
      expect(stats.agility).toBe(7);
      expect(stats.control).toBe(2);
      expect(stats.hpBonus).toBe(10);
    });
  });

  describe('clone', () => {
    test('should create exact copy of StatBlock', () => {
      const original = new StatBlock(5, 3, 7, 2, 10);
      const clone = original.clone();
      
      expect(clone).not.toBe(original); // Different object reference
      expect(clone.equals(original)).toBe(true);
    });
  });

  describe('equals', () => {
    test('should return true for identical StatBlocks', () => {
      const stats1 = new StatBlock(5, 3, 7, 2, 10);
      const stats2 = new StatBlock(5, 3, 7, 2, 10);
      expect(stats1.equals(stats2)).toBe(true);
    });

    test('should return false for different StatBlocks', () => {
      const stats1 = new StatBlock(5, 3, 7, 2, 10);
      const stats2 = new StatBlock(4, 3, 7, 2, 10);
      expect(stats1.equals(stats2)).toBe(false);
    });

    test('should return false for non-StatBlock objects', () => {
      const stats = new StatBlock(5, 3, 7, 2, 10);
      expect(stats.equals({})).toBe(false);
      expect(stats.equals(null)).toBe(false);
      expect(stats.equals(undefined)).toBe(false);
    });
  });

  describe('add', () => {
    test('should add two StatBlocks correctly', () => {
      const stats1 = new StatBlock(5, 3, 7, 2, 10);
      const stats2 = new StatBlock(2, 1, 3, 1, 5);
      const result = stats1.add(stats2);
      
      expect(result.body).toBe(7);
      expect(result.mind).toBe(4);
      expect(result.agility).toBe(10);
      expect(result.control).toBe(3);
      expect(result.hpBonus).toBe(15);
    });

    test('should throw error when adding non-StatBlock', () => {
      const stats = new StatBlock(5, 3, 7, 2, 10);
      expect(() => stats.add({})).toThrow('Can only add StatBlock to StatBlock');
      expect(() => stats.add(null)).toThrow('Can only add StatBlock to StatBlock');
    });
  });

  describe('subtract', () => {
    test('should subtract two StatBlocks correctly', () => {
      const stats1 = new StatBlock(5, 3, 7, 2, 10);
      const stats2 = new StatBlock(2, 1, 3, 1, 5);
      const result = stats1.subtract(stats2);
      
      expect(result.body).toBe(3);
      expect(result.mind).toBe(2);
      expect(result.agility).toBe(4);
      expect(result.control).toBe(1);
      expect(result.hpBonus).toBe(5);
    });

    test('should throw error when subtracting non-StatBlock', () => {
      const stats = new StatBlock(5, 3, 7, 2, 10);
      expect(() => stats.subtract({})).toThrow('Can only subtract StatBlock from StatBlock');
      expect(() => stats.subtract(null)).toThrow('Can only subtract StatBlock from StatBlock');
    });
  });

  describe('getStatNames', () => {
    test('should return array of stat names', () => {
      const stats = new StatBlock();
      const names = stats.getStatNames();
      expect(names).toEqual(['body', 'mind', 'agility', 'control', 'hpBonus', 'guard', 'attack']);
    });
  });

  describe('getStat', () => {
    test('should return correct stat value', () => {
      const stats = new StatBlock(5, 3, 7, 2, 10);
      expect(stats.getStat('body')).toBe(5);
      expect(stats.getStat('mind')).toBe(3);
      expect(stats.getStat('agility')).toBe(7);
      expect(stats.getStat('control')).toBe(2);
      expect(stats.getStat('hpBonus')).toBe(10);
    });

    test('should throw error for unknown stat', () => {
      const stats = new StatBlock();
      expect(() => stats.getStat('unknown')).toThrow('Unknown stat: unknown');
    });
  });

  describe('setStat', () => {
    test('should set stat value correctly', () => {
      const stats = new StatBlock();
      stats.setStat('body', 10);
      expect(stats.body).toBe(10);
    });

    test('should throw error for unknown stat', () => {
      const stats = new StatBlock();
      expect(() => stats.setStat('unknown', 10)).toThrow('Unknown stat: unknown');
    });
  });

  describe('toObject', () => {
    test('should convert to plain object', () => {
      const stats = new StatBlock(5, 3, 7, 2, 10);
      const obj = stats.toObject();
      
      expect(obj).toEqual({
        body: 5,
        mind: 3,
        agility: 7,
        control: 2,
        hpBonus: 10,
        guard: 0,
        attack: 0
      });
    });
  });

  describe('fromObject', () => {
    test('should create StatBlock from plain object', () => {
      const obj = { body: 5, mind: 3, agility: 7, control: 2, hpBonus: 10 };
      const stats = StatBlock.fromObject(obj);
      
      expect(stats.body).toBe(5);
      expect(stats.mind).toBe(3);
      expect(stats.agility).toBe(7);
      expect(stats.control).toBe(2);
      expect(stats.hpBonus).toBe(10);
    });

    test('should use default values for missing properties', () => {
      const obj = { body: 5 };
      const stats = StatBlock.fromObject(obj);
      
      expect(stats.body).toBe(5);
      expect(stats.mind).toBe(0);
      expect(stats.agility).toBe(0);
      expect(stats.control).toBe(0);
      expect(stats.hpBonus).toBe(0);
    });

    test('should handle empty object', () => {
      const stats = StatBlock.fromObject({});
      
      expect(stats.body).toBe(0);
      expect(stats.mind).toBe(0);
      expect(stats.agility).toBe(0);
      expect(stats.control).toBe(0);
      expect(stats.hpBonus).toBe(0);
    });
  });
});
