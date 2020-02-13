import { DroppableConfigApi, DroppableMonitor } from "../DroppableMonitor";
import Pos2d, { Bounds, contains } from "../../../util/shape-math";
import { assert } from "../../../util/invariants";

export interface FakeDroppable extends DroppableConfigApi {
  bounds: Bounds;
  zIndex: number;
  onBeforeDragStart?: () => void;
}

export class FakeDroppableMonitor implements DroppableMonitor {
  private droppables: FakeDroppable[] = [];

  setDroppables(droppables: FakeDroppable[]) {
    this.droppables = droppables;
  }

  findDroppableAt(pos: Pos2d): DroppableConfigApi | undefined {
    return this.droppables
      .filter(droppable => contains(droppable.bounds, pos))
      .sort((left, right) => right.zIndex - left.zIndex)[0];
  }

  getDroppable(id: string): DroppableConfigApi {
    const droppable = this.droppables.find(droppable => droppable.id === id);
    assert(droppable, `Droppable ${id} does not exist`);
    return droppable;
  }

  onBeforeDragStart(): void {
    for (const droppable of this.droppables) {
      if (droppable.onBeforeDragStart) {
        droppable.onBeforeDragStart();
      }
    }
  }
}
