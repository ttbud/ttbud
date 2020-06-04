import { MutableRefObject, RefCallback } from "react";

/**
 * If it exists, assign the given value to the ref
 */
export default function assignRef<T>(
  ref: RefCallback<T> | MutableRefObject<T> | null | undefined,
  value: T
) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
  } else {
    ref.current = value;
  }
}
