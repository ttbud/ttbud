import { DragResult } from "./getDragResult";
import { Icon, ICONS_BY_ID } from "../ui/icons";
import { assert } from "../util/invariants";
import {
  DraggableDescriptor,
  DroppableLocation,
  LocationType
} from "../ui/drag/DragStateTypes";
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
    case DragResult.DRAGGED_INTO:
      const icon = ICONS_BY_ID.get(draggable.icon.id);
      assert(icon, `Icon ID ${draggable.icon.id} is invalid`);
      assert(
        destination.logicalLocation?.type === LocationType.LIST,
        `Dragged into character tray but destination type is not list`
      );
      icons.splice(destination.logicalLocation.idx, 0, icon);
      break;
    case DragResult.MOVED_INSIDE:
      assert(
        destination.logicalLocation?.type === LocationType.LIST,
        `Dragged to character tray but destination type is not list`
      );
      assert(
        source.logicalLocation?.type === LocationType.LIST,
        `Dragged from character tray but source type is not list`
      );
      const [removed] = icons.splice(source.logicalLocation.idx, 1);
      icons.splice(destination.logicalLocation.idx, 0, removed);
      break;
    case DragResult.DRAGGED_OUT_OF:
    case DragResult.NONE:
      break;
    default:
      throw new UnreachableCaseError(dragResult);
  }
}
