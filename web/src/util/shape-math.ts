import { GRID_SIZE_PX, GRID_SIZE_PX_X, GRID_SIZE_PX_Y } from "../config";
import UnreachableCaseError from "./UnreachableCaseError";

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

const THIRTY_DEG_RADIANS = 0.523598775598;

export function snapToGrid(pos: Pos2d): Pos2d {
  const column = Math.floor(pos.x / GRID_SIZE_PX_X);
  const row = Math.floor(pos.y / GRID_SIZE_PX_Y);
  const rowIsEven = row % 2 == 0;
  const distanceToBottomOfRow = (row + 1) * GRID_SIZE_PX_Y - pos.y;

  const distanceToLeftOfColumn = pos.x - column * GRID_SIZE_PX_X;
  const distanceToTopOfRow = pos.y - row * GRID_SIZE_PX_Y;

  const isRightOfForwardSlash =
    distanceToBottomOfRow * Math.tan(THIRTY_DEG_RADIANS) <
    distanceToLeftOfColumn;

  const isRightOfBackslash =
    distanceToTopOfRow * Math.tan(THIRTY_DEG_RADIANS) < distanceToLeftOfColumn;

  let columnOffset;
  switch (column % 6) {
    case 0:
      if (rowIsEven) {
        columnOffset = isRightOfForwardSlash ? 1 : -2;
      } else {
        columnOffset = isRightOfBackslash ? 1 : -2;
      }
      break;
    case 1:
    case 4:
      columnOffset = 0;
      break;
    case 2:
    case 5:
      columnOffset = -1;
      break;
    case 3:
      if (rowIsEven) {
        columnOffset = isRightOfBackslash ? 1 : -2;
      } else {
        columnOffset = isRightOfForwardSlash ? 1 : -2;
      }
      break;
    default:
      //TODO: Better
      throw new Error("ahhh");
  }

  const trueColumn = column + columnOffset;
  const fullHexRow =
    Math.floor(pos.y / (GRID_SIZE_PX_Y * 2)) * GRID_SIZE_PX_Y * 2;
  const isEvenRow = Math.floor(pos.y / GRID_SIZE_PX_Y) % 2;

  const isFirstHex = trueColumn % 6 == 1;
  let rowOffset;
  if (!isFirstHex && isEvenRow) {
    rowOffset = 1;
  } else if (!isFirstHex && !isEvenRow) {
    rowOffset = -1;
  } else {
    rowOffset = 0;
  }

  return {
    x: (trueColumn - 1) * GRID_SIZE_PX_X,
    y: fullHexRow + rowOffset * GRID_SIZE_PX_Y,
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

function snapDimensionToGrid(dimension: number): number {
  return Math.floor(dimension / GRID_SIZE_PX) * GRID_SIZE_PX;
}
