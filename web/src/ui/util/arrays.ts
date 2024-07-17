export function withItem<T>(arr: Array<T>, item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index, arr.length)];
}

export function withoutItem<T>(arr: Array<T>, index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1, arr.length)];
}

export function withReplacedItem<T>(arr: Array<T>, item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index + 1, arr.length)];
}
