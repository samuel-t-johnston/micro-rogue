// Coordinate utility functions for 2D positions
// Uses plain objects {x, y} for simplicity and compatibility

/**
 * Create a new coordinate object
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Coordinate object {x, y}
 */
export function create(x, y) {
  return { x, y };
}

/**
 * Add two coordinates together
 * @param {Object} coord1 - First coordinate {x, y}
 * @param {Object} coord2 - Second coordinate {x, y}
 * @returns {Object} New coordinate with summed values
 */
export function add(coord1, coord2) {
  return { x: coord1.x + coord2.x, y: coord1.y + coord2.y };
}

/**
 * Add a delta to a coordinate
 * @param {Object} coord - Base coordinate {x, y}
 * @param {number} dx - X delta
 * @param {number} dy - Y delta
 * @returns {Object} New coordinate with delta applied
 */
export function addDelta(coord, dx, dy) {
  return { x: coord.x + dx, y: coord.y + dy };
}

/**
 * Check if two coordinates are equal
 * @param {Object} coord1 - First coordinate {x, y}
 * @param {Object} coord2 - Second coordinate {x, y}
 * @returns {boolean} True if coordinates are equal
 */
export function equals(coord1, coord2) {
  return coord1.x === coord2.x && coord1.y === coord2.y;
}

/**
 * Check if a coordinate is within bounds
 * @param {Object} coord - Coordinate to check {x, y}
 * @param {number} minX - Minimum X value (inclusive)
 * @param {number} maxX - Maximum X value (exclusive)
 * @param {number} minY - Minimum Y value (inclusive)
 * @param {number} maxY - Maximum Y value (exclusive)
 * @returns {boolean} True if coordinate is within bounds
 */
export function isWithinBounds(coord, minX, maxX, minY, maxY) {
  return coord.x >= minX && coord.x < maxX && coord.y >= minY && coord.y < maxY;
}

/**
 * Calculate distance between two coordinates (Manhattan distance)
 * @param {Object} coord1 - First coordinate {x, y}
 * @param {Object} coord2 - Second coordinate {x, y}
 * @returns {number} Manhattan distance
 */
export function manhattanDistance(coord1, coord2) {
  return Math.abs(coord1.x - coord2.x) + Math.abs(coord1.y - coord2.y);
}

/**
 * Calculate Euclidean distance between two coordinates
 * @param {Object} coord1 - First coordinate {x, y}
 * @param {Object} coord2 - Second coordinate {x, y}
 * @returns {number} Euclidean distance
 */
export function euclideanDistance(coord1, coord2) {
  const dx = coord1.x - coord2.x;
  const dy = coord1.y - coord2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert coordinate to string representation
 * @param {Object} coord - Coordinate {x, y}
 * @returns {string} String representation "(x, y)"
 */
export function toString(coord) {
  return `(${coord.x}, ${coord.y})`;
}
