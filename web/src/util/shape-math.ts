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

export interface Pos3d {
  x: number;
  y: number;
  z: number;
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

export function contains(bounds: Bounds, pos: Pos2d) {
  return (
    bounds.left < pos.x &&
    bounds.right > pos.x &&
    bounds.top < pos.y &&
    bounds.bottom > pos.y
  );
}

export function centerOf(bounds: Bounds): Pos2d {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return { x: bounds.left + width / 2, y: bounds.top + height / 2 };
}

function snapDimensionToGrid(dimension: number): number {
  return Math.floor(dimension / GRID_SIZE_PX) * GRID_SIZE_PX;
}
