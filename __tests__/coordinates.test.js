import {
  create,
  add,
  addDelta,
  equals,
  isWithinBounds,
  manhattanDistance,
  euclideanDistance,
  toString
} from '../coordinates.js';

describe('Coordinate Utilities', () => {
  describe('create', () => {
    test('should create a coordinate object with given x and y values', () => {
      const coord = create(3, 7);
      expect(coord).toEqual({ x: 3, y: 7 });
    });

    test('should create coordinate with zero values', () => {
      const coord = create(0, 0);
      expect(coord).toEqual({ x: 0, y: 0 });
    });

    test('should create coordinate with negative values', () => {
      const coord = create(-5, -10);
      expect(coord).toEqual({ x: -5, y: -10 });
    });
  });

  describe('add', () => {
    test('should add two coordinates together', () => {
      const coord1 = create(2, 3);
      const coord2 = create(1, 4);
      const result = add(coord1, coord2);
      expect(result).toEqual({ x: 3, y: 7 });
    });

    test('should handle zero coordinates', () => {
      const coord1 = create(5, 5);
      const coord2 = create(0, 0);
      const result = add(coord1, coord2);
      expect(result).toEqual({ x: 5, y: 5 });
    });

    test('should handle negative coordinates', () => {
      const coord1 = create(3, 2);
      const coord2 = create(-1, -3);
      const result = add(coord1, coord2);
      expect(result).toEqual({ x: 2, y: -1 });
    });

    test('should return a new object, not modify originals', () => {
      const coord1 = create(1, 2);
      const coord2 = create(3, 4);
      const result = add(coord1, coord2);
      
      expect(result).not.toBe(coord1);
      expect(result).not.toBe(coord2);
      expect(coord1).toEqual({ x: 1, y: 2 });
      expect(coord2).toEqual({ x: 3, y: 4 });
    });
  });

  describe('addDelta', () => {
    test('should add delta values to coordinate', () => {
      const coord = create(5, 5);
      const result = addDelta(coord, 2, -1);
      expect(result).toEqual({ x: 7, y: 4 });
    });

    test('should handle zero deltas', () => {
      const coord = create(3, 7);
      const result = addDelta(coord, 0, 0);
      expect(result).toEqual({ x: 3, y: 7 });
    });

    test('should handle negative deltas', () => {
      const coord = create(10, 10);
      const result = addDelta(coord, -3, -5);
      expect(result).toEqual({ x: 7, y: 5 });
    });

    test('should return a new object, not modify original', () => {
      const coord = create(1, 1);
      const result = addDelta(coord, 2, 2);
      
      expect(result).not.toBe(coord);
      expect(coord).toEqual({ x: 1, y: 1 });
    });
  });

  describe('equals', () => {
    test('should return true for identical coordinates', () => {
      const coord1 = create(3, 5);
      const coord2 = create(3, 5);
      expect(equals(coord1, coord2)).toBe(true);
    });

    test('should return false for different coordinates', () => {
      const coord1 = create(3, 5);
      const coord2 = create(3, 6);
      expect(equals(coord1, coord2)).toBe(false);
    });

    test('should return false when x values differ', () => {
      const coord1 = create(3, 5);
      const coord2 = create(4, 5);
      expect(equals(coord1, coord2)).toBe(false);
    });

    test('should return false when y values differ', () => {
      const coord1 = create(3, 5);
      const coord2 = create(3, 4);
      expect(equals(coord1, coord2)).toBe(false);
    });

    test('should handle zero coordinates', () => {
      const coord1 = create(0, 0);
      const coord2 = create(0, 0);
      expect(equals(coord1, coord2)).toBe(true);
    });

    test('should handle negative coordinates', () => {
      const coord1 = create(-1, -2);
      const coord2 = create(-1, -2);
      expect(equals(coord1, coord2)).toBe(true);
    });
  });

  describe('isWithinBounds', () => {
    test('should return true for coordinate within bounds', () => {
      const coord = create(5, 5);
      expect(isWithinBounds(coord, 0, 10, 0, 10)).toBe(true);
    });

    test('should return false for coordinate outside bounds', () => {
      const coord = create(15, 5);
      expect(isWithinBounds(coord, 0, 10, 0, 10)).toBe(false);
    });

    test('should return false for coordinate at boundary (exclusive)', () => {
      const coord = create(10, 5);
      expect(isWithinBounds(coord, 0, 10, 0, 10)).toBe(false);
    });

    test('should return true for coordinate at inclusive boundary', () => {
      const coord = create(0, 0);
      expect(isWithinBounds(coord, 0, 10, 0, 10)).toBe(true);
    });

    test('should handle negative bounds', () => {
      const coord = create(-2, -3);
      expect(isWithinBounds(coord, -5, 0, -5, 0)).toBe(true);
    });

    test('should return false for coordinate outside negative bounds', () => {
      const coord = create(-6, -3);
      expect(isWithinBounds(coord, -5, 0, -5, 0)).toBe(false);
    });
  });

  describe('manhattanDistance', () => {
    test('should calculate Manhattan distance between coordinates', () => {
      const coord1 = create(1, 1);
      const coord2 = create(4, 5);
      expect(manhattanDistance(coord1, coord2)).toBe(7); // |4-1| + |5-1| = 3 + 4 = 7
    });

    test('should return zero for identical coordinates', () => {
      const coord1 = create(3, 5);
      const coord2 = create(3, 5);
      expect(manhattanDistance(coord1, coord2)).toBe(0);
    });

    test('should handle negative coordinates', () => {
      const coord1 = create(-2, -3);
      const coord2 = create(1, 2);
      expect(manhattanDistance(coord1, coord2)).toBe(8); // |1-(-2)| + |2-(-3)| = 3 + 5 = 8
    });

    test('should handle same x coordinate', () => {
      const coord1 = create(5, 1);
      const coord2 = create(5, 10);
      expect(manhattanDistance(coord1, coord2)).toBe(9);
    });

    test('should handle same y coordinate', () => {
      const coord1 = create(1, 5);
      const coord2 = create(10, 5);
      expect(manhattanDistance(coord1, coord2)).toBe(9);
    });
  });

  describe('euclideanDistance', () => {
    test('should calculate Euclidean distance between coordinates', () => {
      const coord1 = create(0, 0);
      const coord2 = create(3, 4);
      expect(euclideanDistance(coord1, coord2)).toBe(5); // sqrt(3² + 4²) = sqrt(9 + 16) = sqrt(25) = 5
    });

    test('should return zero for identical coordinates', () => {
      const coord1 = create(3, 5);
      const coord2 = create(3, 5);
      expect(euclideanDistance(coord1, coord2)).toBe(0);
    });

    test('should handle negative coordinates', () => {
      const coord1 = create(-1, -1);
      const coord2 = create(2, 2);
      const result = euclideanDistance(coord1, coord2);
      expect(result).toBeCloseTo(4.2426, 4); // sqrt(3² + 3²) = sqrt(18) ≈ 4.2426
    });

    test('should handle same x coordinate', () => {
      const coord1 = create(5, 1);
      const coord2 = create(5, 4);
      expect(euclideanDistance(coord1, coord2)).toBe(3);
    });

    test('should handle same y coordinate', () => {
      const coord1 = create(1, 5);
      const coord2 = create(4, 5);
      expect(euclideanDistance(coord1, coord2)).toBe(3);
    });
  });

  describe('toString', () => {
    test('should convert coordinate to string representation', () => {
      const coord = create(3, 7);
      expect(toString(coord)).toBe('(3, 7)');
    });

    test('should handle zero coordinates', () => {
      const coord = create(0, 0);
      expect(toString(coord)).toBe('(0, 0)');
    });

    test('should handle negative coordinates', () => {
      const coord = create(-5, -10);
      expect(toString(coord)).toBe('(-5, -10)');
    });

    test('should handle mixed positive and negative coordinates', () => {
      const coord = create(3, -7);
      expect(toString(coord)).toBe('(3, -7)');
    });
  });
});
