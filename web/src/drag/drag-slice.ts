import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import Pos2d, {
  Bounds,
  boundsAreEqual,
  centerOf,
  constrainBoxTo,
} from "../util/shape-math";
import { assert } from "../util/invariants";
import {
  DraggableDescriptor,
  DragState,
  DragStateType,
  DroppableLocation,
} from "./DragStateTypes";
import { AppThunk } from "../store/createStore";

const INITIAL_STATE: DragState = {
  type: DragStateType.NotDragging,
};

interface DragStartAction {
  draggable: DraggableDescriptor;
  source: DroppableLocation;
  mousePos: Pos2d;
  dragBounds?: Bounds;
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
      const { draggable, source, mousePos, dragBounds } = action.payload;
      assert(
        state.type === DragStateType.NotDragging,
        `Draggable ${draggable.id} attempted to start a drag during an existing drag`
      );

      const mouseOffset = {
        x: source.bounds.left - mousePos.x,
        y: source.bounds.top - mousePos.y,
      };

      return {
        type: DragStateType.Dragging,
        draggable: draggable,
        hoveredDroppableId: source.id,
        bounds: source.bounds,
        mouseOffset,
        dragBounds,
        source,
      };
    },
    portalDrag(state, action: PayloadAction<DragPortalAction>) {
      const { draggable, bounds } = action.payload;
      assert(
        state.type === DragStateType.Dragging,
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
      // The wrapper for this action also checks for this case, so this check
      // is impossible to trigger from the public API
      /* istanbul ignore next */
      if (state.type !== DragStateType.Dragging) {
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
      const { draggable, destination } = action.payload;
      assert(
        state.type === DragStateType.Dragging,
        `Draggable ${draggable.id} attempted to release a drag while no drag was occurring`
      );
      assert(
        state.draggable.id === draggable.id,
        `Draggable ${draggable.id} attempted to release a drag while another draggable is dragging`
      );

      // If we don't have a destination, animate back to where we started
      const finalDestination = destination ?? state.source;

      return {
        type: DragStateType.DragEndAnimating,
        draggable: state.draggable,
        source: state.source,
        destination: finalDestination,
      };
    },
    /**
     * Handle this event to get notified when a drag has fully completed, and
     * affected droppables should update their state and re-render
     */
    dragEnded(state, _action: PayloadAction<DragEndAction>) {
      return { type: DragStateType.NotDragging };
    },
  },
});

const {
  dragStarted,
  dragReleased,
  dragMoved,
  dragEnded,
  portalDrag,
} = dragSlice.actions;

/**
 * A drag has started
 *
 * @param draggable The draggable being dragged
 * @param droppableId The droppable parent of the draggable being dragged
 * @param mousePos The client position of the mouse
 * @param bounds The client bounds of the dragged element
 */
function startDrag(
  draggable: DraggableDescriptor,
  droppableId: string | undefined,
  mousePos: Pos2d,
  bounds: Bounds
): AppThunk {
  return (dispatch, getState, { monitor }) => {
    monitor.onBeforeDragStart(draggable, bounds);

    let droppable, location, dragBounds;
    if (droppableId) {
      const center = centerOf(bounds);
      droppable = monitor.getDroppable(droppableId);
      location = droppable.getLocation(draggable, center);
      dragBounds = droppable.getDragBounds?.();
    }
    assert(
      !droppable || location,
      `Droppable ${droppable?.id} did not find a location for a droppable that started dragging from it`
    );

    dispatch(
      dragStarted({
        draggable,
        mousePos,
        dragBounds: dragBounds,
        source: { id: droppable?.id, bounds, ...location },
      })
    );
  };
}

function moveDrag(draggable: DraggableDescriptor, mousePos: Pos2d): AppThunk {
  return (dispatch, getState, { monitor }) => {
    const state = getState();
    if (state.drag.type !== DragStateType.Dragging) {
      // This happens a lot because we get another mouse move event before the store is updated to tell the draggable
      // to stop listening to move events, so just ignore it
      return;
    }

    const bounds = updatedBounds(
      mousePos,
      state.drag.mouseOffset,
      state.drag.source.bounds,
      state.drag.dragBounds
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
      state.drag.type === DragStateType.Dragging,
      `Draggable ${draggable.id} attempted to release a drag while no drag was occurring`
    );

    const bounds = updatedBounds(
      mousePos,
      state.drag.mouseOffset,
      state.drag.source.bounds,
      state.drag.dragBounds
    );
    const center = centerOf(bounds);
    const droppable = monitor.findDroppableAt(center);
    const location = droppable?.getLocation(draggable, center);

    const destination: DroppableLocation | undefined = location
      ? {
          id: droppable?.id,
          ...location,
        }
      : undefined;
    dispatch(dragReleased({ draggable, destination }));

    // If we don't need to animate into position (because we're already there),
    // immediately dispatch the dragEnded action
    if (destination && boundsAreEqual(destination.bounds, bounds)) {
      dispatch(
        dragEnded({
          destination,
          draggable,
          source: state.drag.source,
        })
      );
    }
  };
}

/**
 * Drag animation is complete
 */
function endDrag(draggable: DraggableDescriptor): AppThunk {
  return (dispatch, getState) => {
    const state = getState();
    assert(
      state.drag.type === DragStateType.DragEndAnimating,
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
        draggable,
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
  originalBounds: Bounds,
  dragBounds: Bounds | undefined
): Bounds {
  const width = originalBounds.right - originalBounds.left;
  const height = originalBounds.bottom - originalBounds.top;
  const movedBounds = {
    top: newMousePos.y + mouseOffset.y,
    left: newMousePos.x + mouseOffset.x,
    bottom: newMousePos.y + mouseOffset.y + height,
    right: newMousePos.x + mouseOffset.x + width,
  };
  return dragBounds ? constrainBoxTo(movedBounds, dragBounds) : movedBounds;
}

export {
  startDrag,
  moveDrag,
  releaseDrag,
  endDrag,
  portalDrag,
  /**
   * This shouldn't be called directly, but other slices need to
   * respond to this event to update their state, so we export it
   */
  dragEnded,
};

export default dragSlice.reducer;
