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
  descriptor: TokenDescriptor;
  bounds: Bounds;
}

export interface DragEndEvent {
  draggableId: string;
  originalDescriptor: TokenDescriptor;
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
  const originalDescriptor = useRef<TokenDescriptor>();
  const lastContainer = useRef<string>();

  const dndkitModifiers = modifiers.map((modifier) => {
    return (args: Parameters<Modifier>[0]) =>
      modifier({ ...args, origin: originalDescriptor.current?.origin });
  });

  const dndKitOnDragOver = ({
    active,
    over,
    collisions,
  }: DndKitDragOverEvent) => {
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    assert(
      originalDescriptor.current !== undefined,
      "originalDescriptor is undefined on drag over"
    );

    //TODO: Not this??
    if (over?.id === undefined) {
      console.log("The weird bug where there is no over.id happened");
      return;
    }

    const currentOverId =
      (over?.id as string | undefined) ??
      originalDescriptor.current.origin.containerId;
    // Instead of using the internals of the sortable library, can we just use the origin of the
    // over?
    const currentContainerId =
      over?.data?.current?.sortable?.containerId ?? currentOverId;

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
      originalDescriptor: originalDescriptor.current,
    });

    if (currentContainerId !== lastContainerId) {
      onDragContainerChanged({
        draggableId: active.id as string,
        originalDescriptor: originalDescriptor.current,
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
    originalDescriptor.current = descriptor;
    console.log({ active });
    onDragStart({
      draggableId: active.id as string,
      descriptor,
      bounds: active.rect.current.initial!,
    });
  };

  const dndKitOnDragEnd = ({ active, over }: DndKitDragEndEvent) => {
    assert(
      originalDescriptor.current,
      "originalDescriptor is undefined on drag end"
    );
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    const targetId =
      (over?.id as string | undefined) ??
      originalDescriptor.current.origin.containerId;

    const targetContainerId = over
      ? over?.data?.current?.sortable?.containerId ?? over.id
      : originalDescriptor.current.origin.containerId;

    onDragEnd({
      draggableId: active.id as string,
      descriptor,
      targetId,
      targetContainerId,
      originalDescriptor: originalDescriptor.current,
      bounds: active.rect.current.translated,
    });
    lastContainer.current = undefined;
    originalDescriptor.current = undefined;
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
