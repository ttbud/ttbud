import React, {
  CSSProperties,
  PointerEventHandler,
  ReactElement,
  RefObject,
  TransitionEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { assert } from "../util/invariant";
import UnreachableCaseError from "../util/UnreachableCaseError";
import {
  dragPortaled,
  endDrag,
  moveDrag,
  releaseDrag,
  startDrag
} from "./drag-slice";
import Pos2d, { posAreEqual } from "../util/shape-math";
import { DraggableDescriptor, DragStateType } from "./DragStateTypes";
import { createPortal } from "react-dom";
import { RootState } from "../state/rootReducer";

export interface DragAttributes {
  ref: RefObject<any>;
  style: CSSProperties;
  onPointerDown?: PointerEventHandler;
  onTransitionEnd?: TransitionEventHandler;
}

interface Props {
  descriptor: DraggableDescriptor;
  usePortal?: boolean;
  droppableId?: string;
  children: (
    isDragging: boolean,
    dragAttributes: DragAttributes
  ) => ReactElement | null;
}

const MODIFIER_KEYS = ["Alt", "Control", "Meta", "Shift"];

const modifierKeyPressed = (e: React.MouseEvent): boolean => {
  return MODIFIER_KEYS.some(key => e.getModifierState(key));
};

interface NotDragging {
  type: DragStateType.NOT_DRAGGING;
}

interface DraggingOrAnimating {
  type: DragStateType.DRAGGING | DragStateType.DRAG_END_ANIMATING;
  offset: Pos2d;
}

type InternalDragState = NotDragging | DraggingOrAnimating;

const dragStatesAreEqual = (
  left: InternalDragState,
  right: InternalDragState
) => {
  if (
    left.type === DragStateType.NOT_DRAGGING ||
    right.type === DragStateType.NOT_DRAGGING
  ) {
    return left.type === right.type;
  }

  return left.type === right.type && posAreEqual(left.offset, right.offset);
};

const getStyle = (
  state: InternalDragState,
  usePortal: boolean
): CSSProperties => {
  const style: CSSProperties = {
    userSelect: "none",
    cursor: state.type === DragStateType.DRAGGING ? "grabbing" : "grab"
  };

  if (
    state.type === DragStateType.DRAGGING ||
    state.type === DragStateType.DRAG_END_ANIMATING
  ) {
    style.transform = `translate(${state.offset.x}px, ${state.offset.y}px)`;
    style.zIndex = 10_000;
  }
  if (state.type === DragStateType.DRAG_END_ANIMATING) {
    style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
  }

  const isDragging =
    state.type === DragStateType.DRAGGING ||
    state.type === DragStateType.DRAG_END_ANIMATING;

  if (usePortal && isDragging) {
    style.position = "fixed";
  }
  return style;
};

const LEFT_MOUSE = 1;

const Draggable: React.FC<Props> = ({
  descriptor,
  usePortal = false,
  droppableId,
  children
}) => {
  const ref = useRef<HTMLElement>(null);
  const dispatch = useDispatch();

  const dragState = useSelector((appState: RootState): InternalDragState => {
    const state = appState.drag;
    if (
      state.type === DragStateType.NOT_DRAGGING ||
      // Only care if it's us that's dragging
      state.draggable.id !== descriptor.id
    ) {
      return { type: DragStateType.NOT_DRAGGING };
    }

    switch (state.type) {
      case DragStateType.DRAGGING:
        return {
          type: DragStateType.DRAGGING,
          offset: {
            x: state.bounds.left - state.source.bounds.left,
            y: state.bounds.top - state.source.bounds.top
          }
        };
      case DragStateType.DRAG_END_ANIMATING:
        return {
          type: DragStateType.DRAG_END_ANIMATING,
          offset: {
            x: state.destination.bounds.left - state.source.bounds.left,
            y: state.destination.bounds.top - state.source.bounds.top
          }
        };
      default:
        throw new UnreachableCaseError(state);
    }
  }, dragStatesAreEqual);

  useLayoutEffect(() => {
    // If we're using a portal, we need to re-measure ourselves as
    // soon as we re-render into a portal for dragging since we've
    // likely just jumped around the page
    if (dragState.type !== DragStateType.DRAGGING || !usePortal) {
      return;
    }
    assert(ref.current, `Draggable ${descriptor.id} ref not set`);

    const bounds = ref.current.getBoundingClientRect();
    dispatch(
      dragPortaled({
        draggable: descriptor,
        bounds: {
          top: bounds.top,
          left: bounds.left,
          bottom: bounds.bottom,
          right: bounds.right
        }
      })
    );
  }, [descriptor, dispatch, dragState.type, usePortal]);

  const onPointerDown: PointerEventHandler = useCallback(
    e => {
      if (e.buttons !== LEFT_MOUSE || modifierKeyPressed(e)) {
        return;
      }
      assert(ref.current, `Draggable ${descriptor} did not assign its ref`);

      const bounds = ref.current.getBoundingClientRect();
      const mousePos = { x: e.clientX, y: e.clientY };

      dispatch(
        // Have to copy bounds because ClientRect is not serializable
        startDrag(descriptor, droppableId, mousePos, {
          top: bounds.top,
          left: bounds.left,
          bottom: bounds.bottom,
          right: bounds.right
        })
      );

      e.stopPropagation();
    },
    [descriptor, dispatch, droppableId]
  );

  useEffect(() => {
    const onPointerUp = ({ clientX: x, clientY: y }: PointerEvent) => {
      if (dragState.type !== DragStateType.DRAGGING) {
        return;
      }
      assert(ref.current, `Ref for draggable ${descriptor} not set`);

      dispatch(releaseDrag(descriptor, { x, y }));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragState.type !== DragStateType.DRAGGING) {
        return;
      }

      dispatch(moveDrag(descriptor, { x: e.clientX, y: e.clientY }));
      e.stopPropagation();
    };

    if (dragState.type === DragStateType.DRAGGING) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [descriptor, dragState, dispatch]);

  const onTransitionEnd = useCallback(() => {
    if (dragState.type !== DragStateType.DRAG_END_ANIMATING) {
      return;
    }
    dispatch(endDrag(descriptor));
  }, [descriptor, dispatch, dragState.type]);

  const getHandlers = (state: InternalDragState) => {
    switch (state.type) {
      case DragStateType.NOT_DRAGGING:
        return { onPointerDown };
      case DragStateType.DRAG_END_ANIMATING:
        return { onTransitionEnd };
      case DragStateType.DRAGGING:
        return {};
      default:
        throw new UnreachableCaseError(state);
    }
  };

  const isDragging =
    dragState.type === DragStateType.DRAGGING ||
    dragState.type === DragStateType.DRAG_END_ANIMATING;

  const element = children(isDragging, {
    ref,
    style: getStyle(dragState, usePortal),
    ...getHandlers(dragState)
  });

  return usePortal && isDragging
    ? createPortal(element, document.body)
    : element;
};

export default Draggable;
