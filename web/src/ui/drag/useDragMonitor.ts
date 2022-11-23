import { useCallback, useRef, useState } from "react";
import { DragDescriptor, isDragDescriptor } from "./types";
import {
  Active,
  ClientRect,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { assert } from "../../util/invariants";

interface Location {
  droppableId: string;
  rect: ClientRect;
  sortableIdx?: number;
}

export interface DragEvent {
  dragId: string;
  descriptor: DragDescriptor;
  src: Location;
  prev?: Location;
  current?: Location;
}

interface Args {
  onDrop(drop: DragEvent): void;
  onOver(over: DragEvent): void;
}

function getDragDescriptor(active: Active): DragDescriptor {
  const descriptor = active.data.current;
  assert(
    isDragDescriptor(descriptor),
    `Started drag for ${active} which has no valid drag descriptor`
  );
  return descriptor;
}

export default function useDragMonitor({ onDrop, onOver }: Args) {
  const [activeItem, setActiveItem] = useState<DragDescriptor>();
  const initialLocation = useRef<Location>();
  const previousLocation = useRef<Location>();

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    console.log("dragstart");
    const descriptor = getDragDescriptor(active);
    setActiveItem(descriptor);

    assert(active.rect.current.initial, "Drag started from nowhere?");
    const location = {
      droppableId: descriptor.source,
      sortableIdx: descriptor.sortable?.index,
      rect: active.rect.current.initial,
    };
    initialLocation.current = location;
    previousLocation.current = location;
  }, []);

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      console.log("dragend");
      setActiveItem(undefined);
      const descriptor = getDragDescriptor(active);

      const destSortableData = over?.data.current?.sortable;
      const destId = destSortableData?.containerId ?? over?.id;
      const destIdx = destSortableData?.index;
      const destRect = active.rect.current.translated;
      assert(destRect, "No final rect for drag");

      assert(
        initialLocation.current,
        "Drag ended without initial location set"
      );

      onDrop({
        descriptor,
        // TODO: No cast
        dragId: active.id as string,
        src: initialLocation.current,
        prev: previousLocation.current,
        current: { droppableId: destId, sortableIdx: destIdx, rect: destRect },
      });

      initialLocation.current = undefined;
      previousLocation.current = undefined;
    },
    [onDrop]
  );

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      console.log("dragover");
      const descriptor = getDragDescriptor(active);
      const overSortableData = over?.data.current?.sortable;
      const overId = overSortableData?.containerId ?? over?.id;
      const overIdx = overSortableData?.index;
      const rect = active.rect.current.translated;
      assert(rect, "No final rect for drag");
      assert(
        initialLocation.current,
        "Drag moved without initial location set"
      );

      onOver({
        descriptor,
        // TODO: No cast
        dragId: active.id as string,
        src: initialLocation.current,
        prev: previousLocation.current,
        current: { droppableId: overId, sortableIdx: overIdx, rect },
      });
    },
    [onOver]
  );

  return { activeItem, onDragStart, onDragEnd, onDragOver };
}
