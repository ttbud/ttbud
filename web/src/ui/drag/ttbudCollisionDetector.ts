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
      const height = droppableZIndexes.get(droppable.id) ?? 3;
      if (height > maxHeight) {
        highestDroppable = droppable;
        maxHeight = height;
      }
    }
  }

  if (highestDroppable && sortableContainers.has(highestDroppable.id)) {
    const droppables = droppableContainers.filter(
      (droppable) =>
        isSortableData(droppable.data.current) &&
        droppable.data.current.sortable?.containerId === highestDroppable!.id
    );

    return closestCenter({ ...args, droppableContainers: droppables });
  }

  //TODO: DO droplocation or some sort of equivalent for all returns in this function
  return highestDroppable
    ? [{ ...highestDroppable, dropLocation: active.rect.current.translated }]
    : [];
};

export default ttbudCollisionDetector;
