/**
 * Symmetric shadowcasting (Albert Ford's algorithm): the set of tiles visible from (ox, oy).
 * Coordinates are 0-indexed tile coordinates (origin top-left).
 * @param {number} ox - Origin x.
 * @param {number} oy - Origin y.
 * @param {number} [maxRange] - Max view distance; unlimited if omitted.
 * @param {(x: number, y: number) => boolean} isOpaque - True if a tile blocks sight; must return true for out-of-bounds coordinates.
 * @returns {Set<string>} Visible tile keys as "x,y" strings, always including the origin.
 */
export function computeFov(ox, oy, maxRange, isOpaque) {
  const visible = new Set();
  visible.add(`${ox},${oy}`);

  // [row_x, row_y, col_x, col_y]: maps (depth, col) to world offset from origin.
  // 4 quadrants cover the full 360° around the origin.
  const QUADRANTS = [
    [1, 0, 0, 1],
    [-1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, -1, 1, 0],
  ];

  for (const [rx, ry, cx, cy] of QUADRANTS) {
    const rows = [{ depth: 1, startSlope: -1, endSlope: 1 }];

    for (let i = 0; i < rows.length; i++) {
      const { depth, endSlope } = rows[i];
      let { startSlope } = rows[i];

      if (maxRange !== undefined && depth > maxRange) continue;

      const minCol = roundTiesUp(depth * startSlope);
      const maxCol = roundTiesDown(depth * endSlope);

      let prevOpaque = null;

      for (let col = minCol; col <= maxCol; col++) {
        const wx = ox + depth * rx + col * cx;
        const wy = oy + depth * ry + col * cy;
        const inRange = maxRange === undefined || col * col + depth * depth <= maxRange * maxRange;
        const opaque = isOpaque(wx, wy);

        if (inRange && (opaque || isSymmetric(depth, col, startSlope, endSlope))) {
          visible.add(`${wx},${wy}`);
        }

        if (prevOpaque === true && !opaque) {
          startSlope = tileLeftSlope(depth, col);
        }
        if (prevOpaque === false && opaque) {
          rows.push({ depth: depth + 1, startSlope, endSlope: tileLeftSlope(depth, col) });
        }

        prevOpaque = opaque;
      }

      if (prevOpaque === false) {
        rows.push({ depth: depth + 1, startSlope, endSlope });
      }
    }
  }

  return visible;
}

function isSymmetric(depth, col, startSlope, endSlope) {
  return col >= depth * startSlope && col <= depth * endSlope;
}

// Slope to the left edge of the tile at (depth, col).
function tileLeftSlope(depth, col) {
  return (2 * col - 1) / (2 * depth);
}

function roundTiesUp(n) {
  return Math.floor(n + 0.5);
}

function roundTiesDown(n) {
  return Math.ceil(n - 0.5);
}
