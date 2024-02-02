import { restrictToParentElement } from "@dnd-kit/modifiers";
import { TokenOrigin } from "../token/Character2/Draggable2";
import { MyModifier } from "./App.fixture";

const restrictToFloorTray: MyModifier = (args) => {
  const { transform, origin } = args;
  console.log("In modifier", origin)
  // TODO: Origin being null is a bug, so we should error in that case, not just bail out
  if (origin?.containerId !== "floor-tray") return transform;

  return restrictToParentElement(args);
};

export default restrictToFloorTray;
