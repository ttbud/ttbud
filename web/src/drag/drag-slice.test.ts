import dragReducer, {
  endDrag,
  moveDrag,
  portalDrag,
  releaseDrag,
  startDrag,
} from "./drag-slice";
import { WALL_ICON } from "../ui/icons";
import {
  DraggableType,
  DragState,
  DragStateType,
  LocationType,
  LogicalLocation,
  TokenBlueprintDraggable,
} from "./DragStateTypes";
import { FakeDroppableMonitor } from "./__test_util__/FakeDroppableMonitor";
import {
  configureStore,
  EnhancedStore,
  getDefaultMiddleware,
} from "@reduxjs/toolkit";
import { ContentType } from "../types";

const ORIGIN_BOUNDS = { top: 0, left: 0, bottom: 50, right: 50 };
const MOVED_MOUSE_POS = { x: 100, y: 100 };
const MOVED_BOUNDS = { top: 100, left: 100, bottom: 150, right: 150 };

const ORIGIN_POS = { x: 0, y: 0 };
const NO_OFFSET = { x: 0, y: 0 };

const DRAGGABLE: TokenBlueprintDraggable = {
  id: "draggable-id",
  type: DraggableType.TokenBlueprint,
  contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
};

const INACTIVE_DRAGGABLE: TokenBlueprintDraggable = {
  id: "another-draggable-id",
  type: DraggableType.TokenBlueprint,
  contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
};

const DEFAULT_LOCATION: LogicalLocation = {
  type: LocationType.List,
  idx: 0,
};

const NOT_DRAGGING: DragState = {
  type: DragStateType.NotDragging,
};

const DRAGGING: DragState = {
  type: DragStateType.Dragging,
  draggable: DRAGGABLE,
  source: { bounds: ORIGIN_BOUNDS },
  mouseOffset: NO_OFFSET,
  bounds: MOVED_BOUNDS,
};

const DRAG_END_ANIMATING: DragState = {
  type: DragStateType.DragEndAnimating,
  draggable: DRAGGABLE,
  source: { bounds: ORIGIN_BOUNDS },
  destination: { bounds: ORIGIN_BOUNDS },
};

let monitor: FakeDroppableMonitor;
beforeEach(() => (monitor = new FakeDroppableMonitor()));

function createTestStore(initialState: DragState): EnhancedStore<any, any> {
  return configureStore({
    reducer: { drag: dragReducer },
    preloadedState: { drag: initialState },
    middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
  });
}

it("refuses to start a new drag when a drag is already started", () => {
  const store = createTestStore(DRAGGING);
  store.dispatch(startDrag(DRAGGABLE, undefined, ORIGIN_POS, ORIGIN_BOUNDS));
  expect(store.getState().drag).toEqual(DRAGGING);
});

it("can start a drag outside of a droppable", () => {
  const store = createTestStore(NOT_DRAGGING);

  const bounds = { top: 10, left: 10, bottom: 10, right: 10 };
  const mousePos = { x: 20, y: 20 };
  const expectedMouseOffset = { x: -10, y: -10 };

  store.dispatch(startDrag(DRAGGABLE, undefined, mousePos, bounds));

  expect(store.getState().drag).toEqual({
    type: DragStateType.Dragging,
    draggable: DRAGGABLE,
    source: { bounds: bounds },
    mouseOffset: expectedMouseOffset,
    bounds,
  });
});

it("collects a source location if the draggable came from a droppable", () => {
  const store = createTestStore(NOT_DRAGGING);

  const bounds = { top: 10, left: 10, bottom: 10, right: 10 };
  const mousePos = { x: 20, y: 20 };
  const expectedMouseOffset = { x: -10, y: -10 };

  monitor.setDroppables([
    {
      bounds: MOVED_BOUNDS,
      zIndex: 1,
      id: "droppable id",
      getLocation: () => ({
        bounds,
        logicalLocation: DEFAULT_LOCATION,
      }),
    },
  ]);

  store.dispatch(startDrag(DRAGGABLE, "droppable id", mousePos, bounds));

  expect(store.getState().drag).toEqual({
    type: DragStateType.Dragging,
    draggable: DRAGGABLE,
    source: {
      id: "droppable id",
      bounds: bounds,
      logicalLocation: DEFAULT_LOCATION,
    },
    mouseOffset: expectedMouseOffset,
    hoveredDroppableId: "droppable id",
    bounds,
  });
});

it("refuses to portal when not dragging", () => {
  const store = createTestStore(NOT_DRAGGING);
  expect(() =>
    store.dispatch(
      portalDrag({
        draggable: INACTIVE_DRAGGABLE,
        bounds: ORIGIN_BOUNDS,
      })
    )
  ).toThrow("attempted to portal while no drag was occurring");
});

it("refuses to portal a draggable that is not currently dragging", () => {
  const store = createTestStore(DRAGGING);
  expect(() =>
    store.dispatch(
      portalDrag({ draggable: INACTIVE_DRAGGABLE, bounds: ORIGIN_BOUNDS })
    )
  ).toThrow("attempted to portal while another draggable is dragging");
});

it("updates source bounds when a draggable portals", () => {
  const store = createTestStore(DRAGGING);
  const newBounds = { top: 10, left: 10, bottom: 50, right: 50 };

  store.dispatch(portalDrag({ draggable: DRAGGABLE, bounds: newBounds }));

  expect(store.getState().drag).toEqual({
    ...DRAGGING,
    source: { bounds: newBounds },
  });
});

it("ignores drag move events when a drag isn't started", () => {
  const store = createTestStore(NOT_DRAGGING);

  store.dispatch(moveDrag(DRAGGABLE, ORIGIN_POS));

  expect(store.getState()).toEqual({ drag: NOT_DRAGGING });
});

it("refuses to move a draggable that is not already dragging", () => {
  const store = createTestStore(DRAGGING);
  expect(() =>
    store.dispatch(moveDrag(INACTIVE_DRAGGABLE, ORIGIN_POS))
  ).toThrow("attempted to move while another draggable is dragging");
});

it("updates bounds and hovered droppable on drag move", () => {
  const store = createTestStore(DRAGGING);

  // Create a droppable we will hover over
  monitor.setDroppables([
    {
      bounds: MOVED_BOUNDS,
      zIndex: 1,
      id: "droppable id",
      getLocation: () => undefined,
    },
  ]);

  store.dispatch(moveDrag(DRAGGABLE, MOVED_MOUSE_POS));
  expect(store.getState().drag).toEqual({
    ...DRAGGING,
    bounds: MOVED_BOUNDS,
    hoveredDroppableId: "droppable id",
  });
});

it("refuses to release drags that haven't started", () => {
  const store = createTestStore(NOT_DRAGGING);
  expect(() => store.dispatch(releaseDrag(DRAGGABLE, ORIGIN_POS))).toThrow(
    "attempted to release a drag while no drag was occurring"
  );
});

it("refuses to release a drag from a draggable that is not dragging", () => {
  const store = createTestStore(DRAGGING);
  expect(() =>
    store.dispatch(releaseDrag(INACTIVE_DRAGGABLE, ORIGIN_POS))
  ).toThrow("attempted to release a drag while another draggable is dragging");
});

it("animates back to start when not dropped on a droppable", () => {
  const store = createTestStore(DRAGGING);
  store.dispatch(releaseDrag(DRAGGABLE, MOVED_MOUSE_POS));
  expect(store.getState().drag).toEqual({
    type: DragStateType.DragEndAnimating,
    draggable: DRAGGABLE,
    source: DRAGGING.source,
    destination: DRAGGING.source,
  });
});

it("animates back to start when droppable rejects the drop", () => {
  const store = createTestStore(DRAGGING);

  monitor.setDroppables([
    {
      id: "droppable",
      bounds: MOVED_BOUNDS,
      zIndex: 1,
      getLocation: () => undefined,
    },
  ]);

  store.dispatch(releaseDrag(DRAGGABLE, MOVED_MOUSE_POS));
  expect(store.getState().drag).toEqual({
    type: DragStateType.DragEndAnimating,
    draggable: DRAGGABLE,
    source: DRAGGING.source,
    destination: DRAGGING.source,
  });
});

it("animates to destination if droppable provides one", () => {
  const store = createTestStore(DRAGGING);

  const destination = {
    bounds: { top: 50, left: 50, bottom: 100, right: 100 },
    logicalLocation: DEFAULT_LOCATION,
  };
  monitor.setDroppables([
    {
      id: "droppable",
      bounds: MOVED_BOUNDS,
      zIndex: 1,
      getLocation: () => destination,
    },
  ]);

  store.dispatch(releaseDrag(DRAGGABLE, MOVED_MOUSE_POS));
  expect(store.getState().drag).toEqual({
    type: DragStateType.DragEndAnimating,
    draggable: DRAGGABLE,
    source: DRAGGING.source,
    destination: {
      id: "droppable",
      ...destination,
    },
  });
});

it("skips animating if destination and current bounds are the same", () => {
  const store = createTestStore(DRAGGING);
  const destination = {
    bounds: DRAGGING.bounds,
    logicalLocation: DEFAULT_LOCATION,
  };
  monitor.setDroppables([
    {
      id: "droppable",
      bounds: MOVED_BOUNDS,
      zIndex: 1,
      getLocation: () => destination,
    },
  ]);

  store.dispatch(releaseDrag(DRAGGABLE, MOVED_MOUSE_POS));

  expect(store.getState().drag).toEqual(NOT_DRAGGING);
});

it("refuses to end drags that haven't started", () => {
  const store = createTestStore(NOT_DRAGGING);
  expect(() => store.dispatch(endDrag(DRAGGABLE))).toThrow(
    "tried to finish a drag animation when no drag was occurring"
  );
});

it("refuses to end drags from draggables that aren't dragging", () => {
  const store = createTestStore(DRAG_END_ANIMATING);
  expect(() => store.dispatch(endDrag(INACTIVE_DRAGGABLE))).toThrow(
    "tried to finish a drag animation when another draggable was dragging"
  );
});

it("ends valid drags successfully", () => {
  const store = createTestStore(DRAG_END_ANIMATING);
  store.dispatch(endDrag(DRAGGABLE));
  expect(store.getState().drag).toEqual(NOT_DRAGGING);
});
