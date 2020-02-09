import { List } from "immutable";

export function reorder<T>(
  list: List<T>,
  startIndex: number,
  endIndex: number
): List<T> {
  const removed = list.get(startIndex)!;
  return list.splice(startIndex, 1).splice(endIndex, 0, removed);
}
