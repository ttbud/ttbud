import {
  closestCenter,
  CollisionDetection,
  ClientRect,
  Collision,
} from "@dnd-kit/core";
import { DroppableId, isSortableData } from "./types";
import Pos2d, { centerOf } from "../../util/shape-math";

function contains(layoutRect: ClientRect, pos: Pos2d) {
  return (
    pos.x >= layoutRect.left &&
    pos.y >= layoutRect.top &&
    pos.x <= layoutRect.right &&
    pos.y <= layoutRect.bottom
  );
}

const droppableZIndexes: Map<string, number> = new Map<DroppableId, number>([
  ["board", 0],
  ["floor tray", 1],
  ["character tray", 2],
]);

const ttbudCollisionDetector: CollisionDetection = (args) => {
  const { active, droppableContainers } = args;
  if (!active.rect.current.translated) {
    return [];
  }

  const center = centerOf(active.rect.current.translated);
  const sortableContainers = new Set<string>();
  let highestDroppable: Collision | null = null;
  let maxHeight = -1;
  for (const droppable of droppableContainers) {
    if (!droppable.rect.current) continue;

    if (isSortableData(droppable.data.current)) {
      sortableContainers.add(droppable.data.current.sortable!.containerId);
    } else if (contains(droppable.rect.current, center)) {
      // TODO: No cast
      const height = droppableZIndexes.get(droppable.id as string) ?? 3;
      if (height > maxHeight) {
        highestDroppable = droppable;
        maxHeight = height;
      }
    }
  }

  // TODO: No cast
  if (highestDroppable && sortableContainers.has(highestDroppable.id as string)) {
    const droppables = droppableContainers.filter(
      (droppable) =>
        isSortableData(droppable.data.current) &&
        droppable.data.current.sortable?.containerId === highestDroppable!.id
    );

    const closest = closestCenter({
      ...args,
      droppableContainers: droppables,
    })[0];

    return [
      {
        ...closest,
        data: {
          ...closest.data,
          dropLocation: active.rect.current.translated,
        },
      },
    ];
  }

  return highestDroppable
    ? [{ ...highestDroppable, dropLocation: active.rect.current.translated }]
    : [];
};

export default ttbudCollisionDetector;
