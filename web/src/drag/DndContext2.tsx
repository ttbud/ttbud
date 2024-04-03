import {
  CollisionDetection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverEvent as DndKitDragOverEvent,
  DragStartEvent as DndKitDragStartEvent,
  DragEndEvent as DndKitDragEndEvent,
  DndContext as DndKitContext,
  Modifier as DndKitModifier,
} from "@dnd-kit/core";

import { useRef } from "react";
import { assert } from "../util/invariants";
import { TokenOrigin, TokenDescriptor } from "./Draggable2";
import { Bounds } from "../util/shape-math";

export declare type Transform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

export interface DragOverChangedEvent {
  draggableId: string;
  originalDescriptor: TokenDescriptor;
  descriptor: TokenDescriptor;
  currentContainerId: string;
  currentOverId: string;
  lastContainerId: string;
}

export interface DragStartEvent {
  draggableId: string;
  origin: TokenOrigin;
  descriptor: TokenDescriptor;
}

export interface DragEndEvent {
  draggableId: string;
  origin: TokenOrigin;
  bounds: Bounds | null;
  descriptor: TokenDescriptor;
  targetContainerId: string;
  targetId: string;
}

export type Modifier = (
  args: Parameters<DndKitModifier>[0] & { origin?: TokenOrigin }
) => Transform;

interface DndContextProps {
  onDragContainerChanged: (event: DragOverChangedEvent) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  collisionDetection: CollisionDetection;
  modifiers: Modifier[];
}

interface SortableData {
  sortable?: { containerId: string };
}

const DndContext2: React.FC<DndContextProps> = ({
  onDragStart,
  onDragContainerChanged,
  onDragEnd,
  collisionDetection,
  modifiers,
  children,
}) => {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 0,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);

  const sensors = useSensors(pointerSensor, keyboardSensor);
  // TODO: Change this from origin to a descriptor so we have access
  // to the networkID later
  const originalDescriptor = useRef<TokenDescriptor>();
  const lastContainer = useRef<string>();

  const dndkitModifiers = modifiers.map((modifier) => {
    return (args: Parameters<Modifier>[0]) =>
      modifier({ ...args, origin: origin.current });
  });

  const dndKitOnDragOver = ({
    active,
    over,
    collisions,
  }: DndKitDragOverEvent) => {
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    assert(origin.current !== undefined, "Origin is undefined on drag over");

    //TODO: Not this??
    if (over?.id === undefined) {
      return;
    }

    const currentOverId =
      (over?.id as string | undefined) ?? origin.current.containerId;
    // Instead of using the internals of the sortable library, can we just use the origin of the
    // over?
    const currentContainerId = over
      ? over?.data?.current?.sortable?.containerId ?? over.id
      : origin.current.containerId;

    const lastContainerId = lastContainer.current;
    assert(
      lastContainerId !== undefined,
      "lastContainerId is undefined on drag over"
    );

    console.log("onDragOver", {
      descriptor,
      over,
      currentOverId,
      currentContainerId,
      lastContainerId,
      origin: origin.current,
    });

    if (currentContainerId !== lastContainerId) {
      onDragContainerChanged({
        draggableId: active.id as string,
        originalDescriptor: origin.current,
        currentContainerId,
        descriptor,
        currentOverId,
        lastContainerId,
      });
    }

    lastContainer.current = currentContainerId;
  };

  const dndKitOnDragStart = ({ active }: DndKitDragStartEvent) => {
    const descriptor = active.data.current as TokenDescriptor;
    lastContainer.current = descriptor.origin.containerId;
    origin.current = descriptor.origin;
    onDragStart({
      draggableId: active.id as string,
      descriptor,
      origin: origin.current,
    });
  };

  const dndKitOnDragEnd = ({ active, over }: DndKitDragEndEvent) => {
    assert(origin.current, "Origin is undefined on drag end");
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    const targetId =
      (over?.id as string | undefined) ?? origin.current.containerId;

    const targetContainerId = over
      ? over?.data?.current?.sortable?.containerId ?? over.id
      : origin.current.containerId;

    onDragEnd({
      draggableId: active.id as string,
      descriptor,
      targetId,
      targetContainerId,
      origin: origin.current,
      bounds: active.rect.current.translated,
    });
    lastContainer.current = undefined;
    origin.current = undefined;
  };

  return (
    <DndKitContext
      onDragStart={dndKitOnDragStart}
      onDragOver={dndKitOnDragOver}
      onDragEnd={dndKitOnDragEnd}
      collisionDetection={collisionDetection}
      modifiers={dndkitModifiers}
      sensors={sensors}
    >
      {children}
    </DndKitContext>
  );
};

export default DndContext2;
