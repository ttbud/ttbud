import {
  DragEndEvent,
  DragMoveEvent,
  useDndMonitor,
  ClientRect,
} from "@dnd-kit/core";
import { DragDescriptor, DroppableId } from "./types";
import { assert } from "../../util/invariants";
import { useRef } from "react";

interface DroppedInto {
  type: "dropped into";
  dragId: string;
  descriptor: DragDescriptor;
  rect: ClientRect;
  toIdx?: number;
}

interface DraggedFrom {
  type: "dragged from";
  dragId: string;
  descriptor: DragDescriptor;
  fromIdx?: number;
}

interface MovedInside {
  type: "moved inside";
  dragId: string;
  descriptor: DragDescriptor;
  rect: ClientRect;
  fromIdx?: number;
  toIdx?: number;
}

export type DropEvent = DroppedInto | DraggedFrom | MovedInside;

export default function useDropMonitor(
  droppableId: DroppableId,
  onDrop: (event: DropEvent) => void
) {
  const lastRect = useRef<ClientRect>();

  useDndMonitor({
    onDragMove(event: DragMoveEvent) {
      lastRect.current = event.active.rect.current.translated ?? undefined;
    },
    onDragEnd(event: DragEndEvent) {
      const descriptor = event.active.data.current as DragDescriptor;
      const src = descriptor.source;
      const toSortable = event.over?.data.current?.sortable;

      const fromIdx = descriptor.sortable?.index;
      const toIdx = toSortable?.index;
      // TODO: Real sortable support somehow
      const dest = (toSortable?.containerId ?? event.over?.id) as DroppableId;
      // For some reason there's no rect in the drag end event :(
      const rect = lastRect.current;
      assert(rect, "This is impossible?");

      if (src === droppableId && dest !== droppableId) {
        onDrop({
          type: "dragged from",
          dragId: event.active.id,
          descriptor,
          fromIdx,
        });
      } else if (src !== droppableId && dest === droppableId) {
        onDrop({
          type: "dropped into",
          dragId: event.active.id,
          descriptor,
          rect,
          toIdx,
        });
      } else if (src === droppableId && dest === droppableId) {
        onDrop({
          type: "moved inside",
          dragId: event.active.id,
          descriptor,
          rect,
          fromIdx,
          toIdx,
        });
      }
      // This event didn't involve the droppable we care about, so ignore it
    },
  });
}
