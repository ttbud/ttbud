import { restrictToParentElement } from "@dnd-kit/modifiers";
import { Modifier } from "../../drag/DndContext2";

const restrictToFloorTray: Modifier = (args) => {
  const { transform, origin } = args;
  // TODO: Origin being null is a bug, so we should error in that case, not just bail out
  if (origin?.containerId !== "floor-tray") return transform;

  return restrictToParentElement(args);
};

export default restrictToFloorTray;
