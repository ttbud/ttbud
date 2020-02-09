import { GRID_SIZE_PX } from "../config";

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

export function snapToGrid(pos: Pos2d): Pos2d {
  return {
    x: snapDimensionToGrid(pos.x),
    y: snapDimensionToGrid(pos.y)
  };
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

export function offsetBy(bounds: Bounds, offset: Pos2d): Bounds {
  return {
    top: bounds.top + offset.y,
    left: bounds.left + offset.x,
    bottom: bounds.bottom + offset.y,
    right: bounds.right + offset.x
  };
}

export function centerOf(bounds: Bounds): Pos2d {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return { x: bounds.left + width / 2, y: bounds.top + height / 2 };
}

function snapDimensionToGrid(dimension: number): number {
  return Math.floor(dimension / GRID_SIZE_PX) * GRID_SIZE_PX;
}
