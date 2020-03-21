import { DragEndAction } from "../drag/drag-slice";

export enum DragResult {
  DraggedOutOf = "dragged out of",
  DraggedInto = "dragged into",
  MovedInside = "moved inside",
  None = "none",
}

export default function getDragResult(
  droppableId: string,
  endAction: DragEndAction
): DragResult {
  const { source, destination } = endAction;
  if (source.id === droppableId && destination.id !== droppableId) {
    return DragResult.DraggedOutOf;
  } else if (source.id !== droppableId && destination.id === droppableId) {
    return DragResult.DraggedInto;
  } else if (source.id === droppableId && destination.id === droppableId) {
    return DragResult.MovedInside;
  } else {
    return DragResult.None;
  }
}
