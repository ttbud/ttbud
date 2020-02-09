import { RefObject } from "react";
import { assert } from "../util/invariant";
import Pos2d, { Bounds } from "../util/shape-math";
import { DraggableDescriptor, LogicalLocation } from "./DragStateTypes";

export interface TargetLocation {
  bounds: Bounds;
  logicalLocation: LogicalLocation;
}

export type LocationCollector = (
  draggable: DraggableDescriptor,
  pos: Pos2d
) => TargetLocation | undefined;

export interface DroppableConfig {
  id: string;
  ref: RefObject<HTMLElement>;
  getLocation: LocationCollector;
}

export class DroppableMonitor {
  private droppables = new Map<string, DroppableConfig>();

  /**
   * Return the topmost droppable under the given point
   */
  public findDroppableAt(pos: Pos2d): DroppableConfig | undefined {
    const targets = document.elementsFromPoint(pos.x, pos.y);
    // elementsFromPoint returns elements starting at the topmost element,
    // so the first one we find is guaranteed to be the topmost droppable
    for (const target of targets) {
      for (const droppable of this.droppables.values()) {
        if (target === droppable.ref.current) {
          return droppable;
        }
      }
    }
  }

  public getDroppable(id: string): DroppableConfig {
    const droppable = this.droppables.get(id);
    assert(droppable, `No droppable found with id ${id}`);
    return droppable;
  }

  public addDroppable(config: DroppableConfig) {
    assert(
      !this.droppables.get(config.id),
      `Multiple droppables with id ${config.id}`
    );

    this.droppables.set(config.id, config);
  }

  public removeDroppable(droppableId: string) {
    const deleted = this.droppables.delete(droppableId);
    assert(
      deleted,
      `Tried to remove droppable ${droppableId} which does not exist`
    );
  }
}
