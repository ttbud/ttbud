import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import Pos2d, { Bounds, boundsAreEqual, centerOf } from "../util/shape-math";
import { assert } from "../util/invariants";
import {
  DraggableDescriptor,
  DragState,
  DragStateType,
  DroppableLocation
} from "../ui/drag/DragStateTypes";
import { AppThunk } from "./createStore";

const INITIAL_STATE: DragState = {
  type: DragStateType.NOT_DRAGGING
};

interface DragStartAction {
  draggable: DraggableDescriptor;
  source: DroppableLocation;
  mousePos: Pos2d;
}

interface DragPortalAction {
  draggable: DraggableDescriptor;
  bounds: Bounds;
}

interface DragMoveAction {
  hoveredDroppableId?: string;
  draggable: DraggableDescriptor;
  bounds: Bounds;
}

interface DragReleaseAction {
  bounds: Bounds;
  draggable: DraggableDescriptor;
  destination?: DroppableLocation;
}

export interface DragEndAction {
  draggable: DraggableDescriptor;
  source: DroppableLocation;
  destination: DroppableLocation;
}

const dragSlice = createSlice({
  name: "drag",
  initialState: INITIAL_STATE as DragState,
  reducers: {
    dragStarted(state, action: PayloadAction<DragStartAction>) {
      const { draggable, source, mousePos } = action.payload;
      assert(
        state.type === DragStateType.NOT_DRAGGING,
        `Draggable ${draggable.id} attempted to start a drag during an existing drag`
      );

      const mouseOffset = {
        x: source.bounds.left - mousePos.x,
        y: source.bounds.top - mousePos.y
      };

      return {
        type: DragStateType.DRAGGING,
        draggable: draggable,
        hoveredDroppableId: source.id,
        bounds: source.bounds,
        mouseOffset,
        source
      };
    },
    portalDrag(state, action: PayloadAction<DragPortalAction>) {
      const { draggable, bounds } = action.payload;
      assert(
        state.type === DragStateType.DRAGGING,
        `Draggable ${draggable.id} attempted to portal while no drag was occurring`
      );
      assert(
        state.draggable.id === draggable.id,
        `Draggable ${draggable.id} attempted to portal while another draggable is dragging`
      );

      state.source.bounds = bounds;
    },
    dragMoved(state, action: PayloadAction<DragMoveAction>) {
      const { draggable, bounds, hoveredDroppableId } = action.payload;
      if (state.type !== DragStateType.DRAGGING) {
        // This happens a lot because we get another mouse move event before the store is updated to tell the draggable
        // to stop listening to move events, so just ignore it
        return;
      }
      assert(
        state.draggable.id === draggable.id,
        `Draggable ${draggable.id} attempted to move while another draggable is dragging`
      );

      state.bounds = bounds;
      state.hoveredDroppableId = hoveredDroppableId;
    },
    dragReleased(state, action: PayloadAction<DragReleaseAction>) {
      const { draggable, destination, bounds } = action.payload;
      assert(
        state.type === DragStateType.DRAGGING,
        `Draggable ${draggable.id} attempted to release a drag while no drag was occurring`
      );
      assert(
        state.draggable.id,
        `Draggable ${draggable.id} attempted to release a drag while another draggable is dragging`
      );

      // If we don't have a destination, animate back to where we started
      const finalDestination = destination ?? state.source;

      if (boundsAreEqual(finalDestination.bounds, bounds)) {
        return {
          type: DragStateType.NOT_DRAGGING
        };
      } else {
        return {
          type: DragStateType.DRAG_END_ANIMATING,
          draggable: state.draggable,
          source: state.source,
          destination: finalDestination
        };
      }
    },
    dragEnded(state, _action: PayloadAction<DragEndAction>) {
      return { type: DragStateType.NOT_DRAGGING };
    }
  }
});

const {
  dragStarted,
  dragReleased,
  dragMoved,
  dragEnded,
  portalDrag
} = dragSlice.actions;

function startDrag(
  draggable: DraggableDescriptor,
  droppableId: string | undefined,
  mousePos: Pos2d,
  bounds: Bounds
): AppThunk {
  return (dispatch, getState, { monitor }) => {
    let droppable, location;

    monitor.onBeforeDragStart();

    if (droppableId) {
      const center = centerOf(bounds);
      droppable = monitor.getDroppable(droppableId);
      location = droppable.getLocation(draggable, center);
    }
    assert(
      !droppable || location,
      `Droppable ${droppable?.id} did not find a location for a droppable that started dragging from it`
    );

    dispatch(
      dragStarted({
        draggable,
        mousePos,
        source: { id: droppable?.id, bounds, ...location }
      })
    );
  };
}

function moveDrag(draggable: DraggableDescriptor, mousePos: Pos2d): AppThunk {
  return (dispatch, getState, { monitor }) => {
    const state = getState();
    if (state.drag.type !== DragStateType.DRAGGING) {
      // This happens a lot because we get another mouse move event before the store is updated to tell the draggable
      // to stop listening to move events, so just ignore it
      return;
    }

    const bounds = updatedBounds(
      mousePos,
      state.drag.mouseOffset,
      state.drag.source.bounds
    );
    const hoveredDroppableId = monitor.findDroppableAt(centerOf(bounds))?.id;
    dispatch(dragMoved({ draggable, hoveredDroppableId, bounds }));
  };
}

/**
 * Drag released, now it's time to find the drop destination and animate to it
 */
function releaseDrag(
  draggable: DraggableDescriptor,
  mousePos: Pos2d
): AppThunk {
  return (dispatch, getState, { monitor }) => {
    const state = getState();
    assert(
      state.drag.type === DragStateType.DRAGGING,
      `Draggable tried to release drag when no drag occurred`
    );

    const bounds = updatedBounds(
      mousePos,
      state.drag.mouseOffset,
      state.drag.source.bounds
    );
    const center = centerOf(bounds);
    const droppable = monitor.findDroppableAt(center);
    const location = droppable?.getLocation(draggable, center);

    const destination: DroppableLocation | undefined = location
      ? {
          id: droppable?.id,
          ...location
        }
      : undefined;
    dispatch(dragReleased({ draggable, destination, bounds }));
  };
}

/**
 * Drag animation is complete
 */
function endDrag(draggable: DraggableDescriptor): AppThunk {
  return (dispatch, getState) => {
    const state = getState();
    assert(
      state.drag.type === DragStateType.DRAG_END_ANIMATING,
      `Draggable ${draggable.id} tried to finish a drag animation when no drag was occurring`
    );
    assert(
      state.drag.draggable.id === draggable.id,
      `Draggable ${draggable.id} tried to finish a drag animation when another draggable was dragging`
    );

    dispatch(
      dragEnded({
        source: state.drag.source,
        destination: state.drag.destination,
        draggable
      })
    );
  };
}

/**
 * Calculate the new bounds of a draggable during a drag
 *
 * @param newMousePos The current mouse position
 * @param mouseOffset The difference between the top left of the bounds and the mouse position at drag start
 * @param originalBounds The bounds of the draggable at drag start
 */
function updatedBounds(
  newMousePos: Pos2d,
  mouseOffset: Pos2d,
  originalBounds: Bounds
): Bounds {
  const width = originalBounds.right - originalBounds.left;
  const height = originalBounds.bottom - originalBounds.top;
  return {
    top: newMousePos.y + mouseOffset.y,
    left: newMousePos.x + mouseOffset.x,
    bottom: newMousePos.y + mouseOffset.y + height,
    right: newMousePos.x + mouseOffset.x + width
  };
}

export {
  startDrag,
  moveDrag,
  releaseDrag,
  endDrag,
  portalDrag,
  // This shouldn't be called directly, but other slices need to
  // respond to this event to update their state, so we export it
  dragEnded
};

export default dragSlice.reducer;
