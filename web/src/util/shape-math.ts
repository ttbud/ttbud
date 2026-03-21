import { GRID_SIZE_PX } from "../config";
import { GridType } from "../types";

export interface Bounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export default interface Pos2d {
  x: number;
  y: number;
}

export interface Pos3d {
  x: number;
  y: number;
  z: number;
}

export function distance(first: Pos2d, second: Pos2d): number {
  return Math.sqrt(
    Math.pow(first.x - second.x, 2) + Math.pow(first.y - second.y, 2)
  );
}

export const HEX_WIDTH = GRID_SIZE_PX;
export const HEX_HEIGHT = (Math.sqrt(3) / 2) * HEX_WIDTH;
export const HEX_HORIZONTAL_SPACING = HEX_WIDTH * 0.75;
export const HEX_VERTICAL_SPACING = HEX_HEIGHT;

export function gridToPixel(pos: Pos2d, gridType: GridType): Pos2d {
  if (gridType === GridType.Square) {
    return {
      x: pos.x * GRID_SIZE_PX,
      y: pos.y * GRID_SIZE_PX,
    };
  }

  // Flat-topped hexes with offset coordinates
  // x is column, y is row
  return {
    x: pos.x * HEX_HORIZONTAL_SPACING,
    y:
      pos.y * HEX_VERTICAL_SPACING +
      (pos.x % 2 === 0 ? 0 : HEX_VERTICAL_SPACING / 2),
  };
}

export function pixelToGrid(pos: Pos2d, gridType: GridType): Pos2d {
  if (gridType === GridType.Square) {
    return {
      x: Math.floor(pos.x / GRID_SIZE_PX),
      y: Math.floor(pos.y / GRID_SIZE_PX),
    };
  }

  // Offset input by half a hex to align with gridToPixel origin (top-left)
  const x = pos.x - HEX_WIDTH / 2;
  const y = pos.y - HEX_HEIGHT / 2;

  // A flat-topped hex has a radius equal to half its width
  // See https://www.redblobgames.com/grids/hexagons/
  const radius = HEX_WIDTH / 2;
  const q = ((2 / 3) * x) / radius;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / radius;

  // Find the nearest hex center to the pixel position
  let rx = Math.round(q);
  let ry = Math.round(r);
  let rz = Math.round(-q - r);

  const xDiff = Math.abs(rx - q);
  const yDiff = Math.abs(ry - r);
  const zDiff = Math.abs(rz - (-q - r));

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  }

  // Convert axial (q, r) to odd-q offset (col, row)
  const col = rx;
  const row = ry + (rx - (rx & 1)) / 2;

  return { x: col, y: row };
}

/**
 * Snaps a continuous pixel position to the nearest discrete grid cell.
 */
export function snapToGrid(
  pos: Pos2d,
  gridType: GridType = GridType.Square
): Pos2d {
  // gridToPixel returns the top left of a given cell, so finding the current
  // cell for pos and then calling gridToPixel will give us the top left of
  // the cell that pos is in.
  const gridPos = pixelToGrid(pos, gridType);
  return gridToPixel(gridPos, gridType);
}

export function posAreEqual(left: Pos2d, right: Pos2d): boolean {
  return left.x === right.x && left.y === right.y;
}

export function boundsAreEqual(left: Bounds, right: Bounds): boolean {
  return (
    left.top === right.top &&
    left.left === right.left &&
    left.bottom === right.bottom &&
    left.right === right.right
  );
}

export function contains(bounds: Bounds, pos: Pos2d) {
  return (
    bounds.left <= pos.x &&
    bounds.right >= pos.x &&
    bounds.top <= pos.y &&
    bounds.bottom >= pos.y
  );
}

export function centerOf(bounds: Bounds): Pos2d {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return { x: bounds.left + width / 2, y: bounds.top + height / 2 };
}

export function constrainBoxTo(box: Bounds, bounds: Bounds): Bounds {
  let top, bottom;
  if (box.bottom > bounds.bottom) {
    bottom = bounds.bottom;
    top = bottom - height(box);
  } else if (box.top < bounds.top) {
    top = bounds.top;
    bottom = top + height(box);
  } else {
    top = box.top;
    bottom = box.bottom;
  }

  let left, right;
  if (box.right > bounds.right) {
    right = bounds.right;
    left = right - width(box);
  } else if (box.left < bounds.left) {
    left = bounds.left;
    right = left + width(box);
  } else {
    left = box.left;
    right = box.right;
  }

  return { top, left, bottom, right };
}

export function width(bounds: Bounds) {
  return bounds.right - bounds.left;
}

export function height(bounds: Bounds) {
  return bounds.bottom - bounds.top;
}
