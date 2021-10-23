import { closestCenter, CollisionDetection, LayoutRect } from "@dnd-kit/core";
import { DroppableId, isSortableData } from "./types";
import Pos2d, { centerOf } from "../../util/shape-math";

function contains(layoutRect: LayoutRect, pos: Pos2d) {
  return (
    pos.x >= layoutRect.offsetLeft &&
    pos.y >= layoutRect.offsetTop &&
    pos.x <= layoutRect.offsetLeft + layoutRect.width &&
    pos.y <= layoutRect.offsetTop + layoutRect.height
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
    return null;
  }

  const center = centerOf(active.rect.current.translated);
  const sortableContainers = new Set<string>();
  let highestDroppable: string | null = null;
  let maxHeight = -1;
  for (const droppable of droppableContainers) {
    if (!droppable.rect.current) continue;

    if (isSortableData(droppable.data.current)) {
      sortableContainers.add(droppable.data.current.sortable!.containerId);
    } else if (contains(droppable.rect.current, center)) {
      const height = droppableZIndexes.get(droppable.id) ?? 3;
      if (height > maxHeight) {
        highestDroppable = droppable.id;
        maxHeight = height;
      }
    }
  }

  if (highestDroppable && sortableContainers.has(highestDroppable)) {
    const droppables = droppableContainers.filter(
      (droppable) =>
        isSortableData(droppable.data.current) &&
        droppable.data.current.sortable?.containerId === highestDroppable
    );

    return closestCenter({ ...args, droppableContainers: droppables });
  }

  return highestDroppable;
};

export default ttbudCollisionDetector;
