import type { Modifier } from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { TokenOrigin } from "../token/Character2/Draggable2";

const restrictToFloorTray: Modifier = (e) => {
  const { active, transform } = e;
  const origin = active?.data?.current?.origin as TokenOrigin | undefined;
  // TODO: Origin being null is a bug, so we should error in that case, not just bail out
  if (origin?.containerId !== "floor-tray") return transform;

  return restrictToParentElement(e);
};

export default restrictToFloorTray;
