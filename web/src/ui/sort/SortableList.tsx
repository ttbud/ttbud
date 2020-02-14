import React, {
  CSSProperties,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useRef
} from "react";
import Droppable, { DroppableAttributes } from "../../drag/Droppable";
import Draggable, { DragAttributes } from "../../drag/Draggable";
import Pos2d, { centerOf } from "../../util/shape-math";
import { shallowEqual, useSelector } from "react-redux";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { LocationCollector } from "../../drag/DroppableMonitor";
import { assert } from "../../util/invariants";
import {
  DraggableDescriptor,
  DragStateType,
  DroppableLocation,
  LocationType
} from "../../drag/DragStateTypes";
import { RootState } from "../../state/rootReducer";

export interface DraggableItem {
  descriptor: DraggableDescriptor;
}

interface Props<T> {
  items: T[];
  children: (
    item: T,
    isDragging: boolean,
    attributes: DragAttributes
  ) => ReactElement;
  id: string;
}

interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

const SHUFFLE_TRANSITION = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
const SPACER_TRANSITION = "height 0.2s cubic-bezier(0.2, 0, 0, 1)";

interface SortState {
  draggableId?: string;
  dragStartIdx?: number;
  hoverIdx?: number;
  isHovering: boolean;
  isDragging: boolean;
}

const NOT_SORTING: SortState = {
  isDragging: false,
  isHovering: false
};

interface HoverState {
  pos: Pos2d;
  dragStartedHere: boolean;
  isHovering: boolean;
}

function getListIdx(
  droppableId: string,
  location: DroppableLocation
): number | undefined {
  if (location.id === droppableId) {
    assert(
      location.logicalLocation?.type === LocationType.LIST,
      "Location is sortable list but logical location is not of type list"
    );

    return location.logicalLocation.idx;
  }

  return;
}

// Have to define as a function here so we can have generics
export default function SortableList<T extends DraggableItem>({
  id,
  items,
  children: renderChild
}: PropsWithChildren<Props<T>>): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const childrenBounds = useRef<Rect[]>([]);
  const childrenBoundsWithEmptySlot = useRef<Rect[]>([]);

  const getHoverIdx = ({
    pos,
    dragStartedHere,
    isHovering
  }: HoverState): number | undefined => {
    if (!childrenBoundsWithEmptySlot || !childrenBounds || !isHovering) {
      return;
    }

    const bounds = dragStartedHere
      ? childrenBounds.current
      : childrenBoundsWithEmptySlot.current;
    for (const [idx, bound] of bounds.entries()) {
      if (pos.y < bound.bottom) {
        return idx;
      }
    }
  };

  const {
    isHovering,
    isDragging,
    hoverIdx,
    dragStartIdx,
    draggableId
  } = useSelector((state: RootState): SortState => {
    const dragState = state.drag;

    switch (dragState.type) {
      case DragStateType.NOT_DRAGGING:
        return NOT_SORTING;
      case DragStateType.DRAGGING:
        if (dragState.source.id === id) {
          assert(
            dragState.source.logicalLocation?.type === LocationType.LIST,
            "Drag started from sortable list but source location isn't of type list"
          );
        }

        return {
          isHovering: dragState.hoveredDroppableId === id,
          isDragging: true,
          hoverIdx: getHoverIdx({
            pos: centerOf(dragState.bounds),
            dragStartedHere: dragState.source.id === id,
            isHovering: dragState.hoveredDroppableId === id
          }),
          dragStartIdx: getListIdx(id, dragState.source),
          draggableId: dragState.draggable?.id
        };
      case DragStateType.DRAG_END_ANIMATING:
        return {
          isHovering: dragState.destination.id === id,
          isDragging: true,
          hoverIdx: getListIdx(id, dragState.destination),
          draggableId: dragState.draggable?.id,
          dragStartIdx: getListIdx(id, dragState.source)
        };
      default:
        throw new UnreachableCaseError(dragState);
    }
  }, shallowEqual);

  const onBeforeDragStart = useCallback(() => {
    assert(container.current, "Container ref not set");

    //TODO: Uhh, not this
    const children = container.current.children[0].children;
    const bounds = [];
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      bounds.push(rect);
    }

    const boundsWithEmptySlot = Array.from<Rect>(bounds);
    //TODO: Handle the case that there are no children
    const firstChild = bounds[0];
    const secondChild = bounds[1];
    const margin = secondChild.top - firstChild.bottom;
    const height = firstChild.bottom - firstChild.top;
    boundsWithEmptySlot.unshift({
      top: firstChild.top - margin - height,
      right: firstChild.right,
      bottom: firstChild.top - margin,
      left: firstChild.left
    });
    childrenBoundsWithEmptySlot.current = boundsWithEmptySlot;
    childrenBounds.current = bounds;
  }, []);

  const getLocation: LocationCollector = useCallback(
    (draggable, pos) => {
      const dragStartedHere = items.some(
        item => item.descriptor.id === draggable.id
      );
      const childBounds = dragStartedHere
        ? childrenBounds.current
        : childrenBoundsWithEmptySlot.current;

      for (const [idx, bounds] of childBounds.entries()) {
        if (pos.y < bounds.bottom) {
          return {
            logicalLocation: {
              type: LocationType.LIST,
              idx
            },
            bounds: {
              top: bounds.top,
              left: bounds.left,
              bottom: bounds.bottom,
              right: bounds.right
            }
          };
        }
      }
    },
    [items]
  );

  const getChildStyle = useCallback(
    (idx: number, childDraggableId: string): CSSProperties => {
      if (draggableId === childDraggableId || !isDragging) {
        return {};
      }

      if (hoverIdx === undefined) {
        return {
          transition: SHUFFLE_TRANSITION
        };
      }

      const eDragStartIdx = dragStartIdx === undefined ? 0 : dragStartIdx;
      const eIdx = dragStartIdx === undefined ? idx + 1 : idx;

      const bounds =
        dragStartIdx === undefined
          ? childrenBoundsWithEmptySlot
          : childrenBounds;

      if (
        hoverIdx < eDragStartIdx &&
        eDragStartIdx > eIdx &&
        hoverIdx <= eIdx
      ) {
        const oldBounds = bounds.current[eIdx];
        const newBounds = bounds.current[eIdx + 1];
        const offset = newBounds.top - oldBounds.top;

        return {
          transform: `translate(0px, ${offset}px)`,
          transition: SHUFFLE_TRANSITION
        };
      } else if (
        hoverIdx > eDragStartIdx &&
        eDragStartIdx < eIdx &&
        hoverIdx >= eIdx
      ) {
        const oldBounds = bounds.current[eIdx];
        const newBounds = bounds.current[eIdx - 1];
        const offset = newBounds.top - oldBounds.top;

        return {
          transform: `translate(0px, ${offset}px)`,
          transition: SHUFFLE_TRANSITION
        };
      } else {
        return {
          transition: SHUFFLE_TRANSITION
        };
      }
    },
    [dragStartIdx, draggableId, hoverIdx, isDragging]
  );

  const renderSpacer = useCallback(() => {
    if (!isDragging || dragStartIdx !== undefined) {
      return;
    }

    let style: CSSProperties;
    if (isHovering) {
      style = { height: 40, transition: SPACER_TRANSITION };
    } else {
      style = { height: 0, transition: SPACER_TRANSITION, margin: 0 };
    }

    return <div style={style} />;
  }, [dragStartIdx, isDragging, isHovering]);

  const renderChildren = useCallback(
    (attributes: DroppableAttributes) => (
      <div {...attributes}>
        {renderSpacer()}
        {items.map((item, idx) => (
          <Draggable
            key={item.descriptor.id}
            descriptor={item.descriptor}
            droppableId={id}
          >
            {(isDragging, attributes) =>
              renderChild(item, isDragging, {
                ...attributes,
                style: {
                  ...attributes.style,
                  ...getChildStyle(idx, item.descriptor.id)
                }
              })
            }
          </Draggable>
        ))}
      </div>
    ),
    [getChildStyle, id, items, renderChild, renderSpacer]
  );

  return (
    <div ref={container}>
      <Droppable
        id={id}
        getLocation={getLocation}
        onBeforeDragStart={onBeforeDragStart}
      >
        {renderChildren}
      </Droppable>
    </div>
  );
}
