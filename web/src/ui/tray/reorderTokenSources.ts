import { DragResult } from "../../drag/getDragResult";
import { assert } from "../../util/invariants";
import {
  DraggableDescriptor,
  DroppableLocation,
  LocationType,
} from "../../drag/DragStateTypes";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { contentId, TokenContents } from "../../types";

interface ReorderTokenSourcesParams {
  sources: TokenContents[];
  dragResult: DragResult;
  source: DroppableLocation;
  destination: DroppableLocation;
  draggable: DraggableDescriptor;
}

export function reorderTokenSources({
  sources,
  dragResult,
  source,
  destination,
  draggable,
}: ReorderTokenSourcesParams) {
  switch (dragResult) {
    case DragResult.DraggedInto:
      const draggableContentsId = contentId(draggable.contents);
      if (
        sources.some((content) => contentId(content) === draggableContentsId)
      ) {
        return;
      }
      assert(
        destination.logicalLocation?.type === LocationType.List,
        `Dragged into character tray but destination type is not list`
      );
      sources.splice(destination.logicalLocation.idx, 0, draggable.contents);
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
      const [removed] = sources.splice(source.logicalLocation.idx, 1);
      sources.splice(destination.logicalLocation.idx, 0, removed);
      break;
    case DragResult.DraggedOutOf:
    case DragResult.None:
      break;
    default:
      throw new UnreachableCaseError(dragResult);
  }
}
