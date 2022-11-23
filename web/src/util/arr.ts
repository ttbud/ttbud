export function withItemAt<T>(items: T[], item: T, idx: number): T[] {
  return [...items.slice(0, idx), item, ...items.slice(idx, items.length)];
}

export function withoutItemAt<T>(items: T[], idx: number): T[] {
  return [...items.slice(0, idx), ...items.slice(idx + 1, items.length)];
}

export function withItemReplaced<T>(items: T[], newItem: T, idx: number): T[] {
  return [
    ...items.slice(0, idx),
    newItem,
    ...items.slice(idx + 1, items.length),
  ];
}

export function withItemMoved<T>(
  items: T[],
  fromIdx: number,
  toIdx: number
): T[] {
  if (fromIdx === toIdx) return items;

  const copy = [...items];
  const item = copy.splice(fromIdx, 1)[0];
  copy.splice(toIdx, 0, item);
  return copy;
}
