import { DragResult } from "./getDragResult";
import { Icon, ICONS_BY_ID } from "../ui/icons";
import { assert } from "../util/invariants";
import {
  DraggableDescriptor,
  DroppableLocation,
  LocationType
} from "../drag/DragStateTypes";
import UnreachableCaseError from "../util/UnreachableCaseError";

interface ReorderIconsParams {
  icons: Icon[];
  dragResult: DragResult;
  source: DroppableLocation;
  destination: DroppableLocation;
  draggable: DraggableDescriptor;
}

export function reorderIcons({
  icons,
  dragResult,
  source,
  destination,
  draggable
}: ReorderIconsParams) {
  switch (dragResult) {
    case DragResult.DraggedInto:
      if (icons.some(icon => icon.id === draggable.icon.id)) {
        return;
      }
      const icon = ICONS_BY_ID.get(draggable.icon.id);
      assert(icon, `Icon ID ${draggable.icon.id} is invalid`);
      assert(
        destination.logicalLocation?.type === LocationType.List,
        `Dragged into character tray but destination type is not list`
      );
      icons.splice(destination.logicalLocation.idx, 0, icon);
      break;
    case DragResult.MovedInside:
      assert(
        destination.logicalLocation?.type === LocationType.List,
        `Dragged to character tray but destination type is not list`
      );
      assert(
        source.logicalLocation?.type === LocationType.List,
        `Dragged from character tray but source type is not list`
      );
      const [removed] = icons.splice(source.logicalLocation.idx, 1);
      icons.splice(destination.logicalLocation.idx, 0, removed);
      break;
    case DragResult.DraggedOutOf:
    case DragResult.None:
      break;
    default:
      throw new UnreachableCaseError(dragResult);
  }
}
