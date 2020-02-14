import { DragEndAction } from "../drag/drag-slice";

export enum DragResult {
  DRAGGED_OUT_OF = "dragged out of",
  DRAGGED_INTO = "dragged into",
  MOVED_INSIDE = "moved inside",
  NONE = "none"
}

export default function getDragResult(
  droppableId: string,
  endAction: DragEndAction
): DragResult {
  const { source, destination } = endAction;
  if (source.id === droppableId && destination.id !== droppableId) {
    return DragResult.DRAGGED_OUT_OF;
  } else if (source.id !== droppableId && destination.id === droppableId) {
    return DragResult.DRAGGED_INTO;
  } else if (source.id === droppableId && destination.id === droppableId) {
    return DragResult.MOVED_INSIDE;
  } else {
    return DragResult.NONE;
  }
}
