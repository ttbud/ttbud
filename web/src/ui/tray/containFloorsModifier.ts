import { Modifier } from "@dnd-kit/core";
import { assert } from "../../util/invariants";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { isDragDescriptor } from "../drag/types";

export const containFloorsModifier: Modifier = (args) => {
  const { active, transform } = args;
  if (!active) {
    return transform;
  }

  const descriptor = active.data.current;
  if (!isDragDescriptor(descriptor)) {
    debugger;
  }
  assert(isDragDescriptor(descriptor), "Invalid drag descriptor");

  if (descriptor.source === "floor tray") {
    return restrictToParentElement(args);
  } else {
    return transform;
  }
};
