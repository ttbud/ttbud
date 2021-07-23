import { MutableRefObject, Ref, RefCallback } from "react";
import assignRef from "./assignRef";

/**
 * Create a single ref from an array of refs
 *
 * Useful if you need multiple references to the same DOM node
 */
export default function mergeRefs<T>(
  ...refs: Array<RefCallback<T | null> | MutableRefObject<T | null>>
): Ref<T> {
  const filteredRefs = refs.filter(Boolean);
  if (!filteredRefs.length) return null;
  if (filteredRefs.length === 1) return filteredRefs[0];

  return (value: T) => {
    for (const ref of filteredRefs) {
      assignRef(ref, value);
    }
  };
}
