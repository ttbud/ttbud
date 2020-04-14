import { makeStyles, Paper } from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import React, { createRef, memo, useCallback, useMemo, useRef } from "react";
import { CARD_SIZE } from "../../config";
import {
  DraggableDescriptor,
  DraggableType,
  IconDraggable,
} from "../../drag/DragStateTypes";
import { assert } from "../../util/invariants";
import { Bounds } from "../../util/shape-math";
import { DROPPABLE_IDS } from "../DroppableIds";
import { Icon } from "../icons";
import SortableList, { Target, Targets } from "../sort/SortableList";
import { RootState } from "../../store/rootReducer";
import { removeIcon, setActiveFloor } from "./floor-tray-slice";
import { connect } from "react-redux";

interface Props {
  icons: Icon[];
  activeFloor: Icon;
  onFloorSelected: (icon: Icon) => void;
  onFloorRemoved: (icon: Icon) => void;
}

const mapStateToProps = (state: RootState) => ({
  icons: state.floorTray.icons,
  activeFloor: state.floorTray.activeFloor,
});

const dispatchProps = {
  onFloorSelected: setActiveFloor,
  onFloorRemoved: removeIcon,
};

const useStyles = makeStyles({
  icon: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
});

const PureFloorTray: React.FC<Props> = memo(function FloorTray({
  icons,
  activeFloor,
  onFloorSelected,
  onFloorRemoved,
}) {
  const classes = useStyles();

  const containerRef = useRef<HTMLElement>();

  const itemRefs = useMemo(() => {
    const refs = new Map<string, React.MutableRefObject<HTMLElement | null>>();
    for (const icon of icons) {
      refs.set(icon.id, createRef<HTMLElement>());
    }
    return refs;
  }, [icons]);

  const items = icons.map((icon) => ({
    icon,
    descriptor: {
      type: DraggableType.Icon,
      id: `${DROPPABLE_IDS.FLOOR_TRAY}-${icon.id}`,
      icon: icon,
    } as IconDraggable,
  }));

  const getTargets = useCallback(
    (draggable: DraggableDescriptor, bounds: Bounds): Targets => {
      const existingElementsBounds = [];
      for (const itemRef of itemRefs.values()) {
        assert(
          itemRef.current,
          "Floor tray item refs not set up correctly before drag"
        );
        existingElementsBounds.push(itemRef.current.getBoundingClientRect());
      }

      assert(
        containerRef.current,
        "Character tray container ref not set up correctly before drag"
      );
      const innerDragBounds: Target[] = [];
      for (let i = 0; i < existingElementsBounds.length; i++) {
        const current = existingElementsBounds[i];

        innerDragBounds.push({
          dropBounds: {
            top: current.top,
            left: current.left,
            bottom: current.bottom,
            right: current.right,
          },
          destination: {
            top: current.top,
            left: current.left,
            bottom: current.bottom,
            right: current.right,
          },
        });
      }

      const firstChildBounds = existingElementsBounds[0];
      assert(
        firstChildBounds,
        "Must always have at least one element in floor tray"
      );

      const childWidth = firstChildBounds.right - firstChildBounds.left;
      const childHeight = firstChildBounds.bottom - firstChildBounds.top;
      const widthDiff = childWidth - (bounds.right - bounds.left);
      const heightDiff = childHeight - (bounds.bottom - bounds.top);

      const outerDragBounds = innerDragBounds.map(
        ({ dropBounds, destination }) => ({
          dropBounds: {
            top: dropBounds.top,
            left: dropBounds.left + childWidth / 2,
            bottom: dropBounds.bottom,
            right: dropBounds.right + childWidth / 2,
          },
          destination: {
            top: destination.top + heightDiff / 2,
            left: destination.left + childWidth / 2 + widthDiff / 2,
            bottom: destination.bottom,
            right: destination.right + childWidth / 2,
          },
        })
      );

      const { dropBounds, destination } = outerDragBounds[0];

      outerDragBounds.unshift({
        dropBounds: {
          top: dropBounds.top,
          left: dropBounds.left - childWidth,
          bottom: dropBounds.bottom,
          right: dropBounds.right - childWidth,
        },
        destination: {
          top: destination.top,
          left: destination.left - childWidth,
          bottom: destination.bottom,
          right: destination.left,
        },
      });

      return {
        innerDrag: innerDragBounds,
        outerDrag: outerDragBounds,
      };
    },
    [itemRefs]
  );

  return (
    <Paper ref={containerRef}>
      <SortableList
        id={DROPPABLE_IDS.FLOOR_TRAY}
        items={items}
        getTargets={getTargets}
        constrainDragsToContainer={true}
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        {(item, isDragging, attributes) => (
          <ToggleButton
            value={item.icon}
            key={item.icon.id}
            selected={activeFloor.id === item.icon.id}
            onChange={() => onFloorSelected(item.icon)}
            onContextMenu={(e) => {
              if (icons.length > 2) {
                onFloorRemoved(item.icon);
              }
              e.preventDefault();
            }}
            {...attributes}
            ref={(el: HTMLElement | null) => {
              itemRefs.get(item.icon.id)!.current = el;
              attributes.ref.current = el;
            }}
          >
            <img
              src={item.icon.img}
              className={classes.icon}
              alt={item.icon.desc}
              draggable={false}
            />
          </ToggleButton>
        )}
      </SortableList>
    </Paper>
  );
});

const FloorTray = connect(mapStateToProps, dispatchProps)(PureFloorTray);

export default FloorTray;
export { PureFloorTray };
