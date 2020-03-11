import { makeStyles, Paper } from "@material-ui/core";
import React, { createRef, memo, useMemo, useRef, useCallback } from "react";
import { DraggableType, IconDraggable } from "../../drag/DragStateTypes";
import { DROPPABLE_IDS } from "../DroppableIds";
import { Icon } from "../icons";
import SortableList, { Targets, Target } from "../sort/SortableList";
import Character from "../token/Character";
import { assert } from "../../util/invariants";
import { GRID_SIZE_PX } from "../../config";

const useStyles = makeStyles(theme => ({
  tokenSheet: {
    backgroundColor: "#cccccc",
    padding: theme.spacing(1),
    "& div": {
      marginBottom: theme.spacing(1)
    },
    "& div:last-child": {
      marginBottom: 0
    }
  }
}));

const DROPPABLE_ID = DROPPABLE_IDS.CHARACTER_TRAY;

interface Props {
  icons: Icon[];
  onIconRemoved: (icon: Icon) => void;
}

const CharacterTray: React.FC<Props> = memo(function CharacterTray({
  icons,
  onIconRemoved
}) {
  const classes = useStyles();

  const items = icons.map(icon => ({
    icon,
    descriptor: {
      type: DraggableType.Icon,
      id: `${DROPPABLE_ID}-${icon.id}`,
      icon: icon
    } as IconDraggable
  }));

  const containerRef = useRef<HTMLElement>();

  const itemRefs = useMemo(() => {
    const refs = new Map<string, React.MutableRefObject<HTMLElement | null>>();
    for (const icon of icons) {
      refs.set(icon.id, createRef<HTMLElement>());
    }
    return refs;
  }, [icons]);

  const getTargets = useCallback((): Targets => {
    const existingElementsBounds = [];
    for (const itemRef of itemRefs.values()) {
      assert(
        itemRef.current,
        "Character tray item refs not set up correctly before drag"
      );
      existingElementsBounds.push(itemRef.current.getBoundingClientRect());
    }

    assert(
      containerRef.current,
      "Character tray container ref not set up correctly before drag"
    );
    const containerBounds = containerRef.current.getBoundingClientRect();
    const innerDragBounds: Target[] = [];
    for (let i = 0; i < existingElementsBounds.length; i++) {
      const prev = existingElementsBounds[i - 1];
      const current = existingElementsBounds[i];
      const next = existingElementsBounds[i + 1];

      const top = prev ? (prev.bottom + current.top) / 2 : containerBounds.top;
      const bottom = next
        ? (next.top + current.bottom) / 2
        : containerBounds.bottom;
      innerDragBounds.push({
        dropBounds: {
          top,
          left: containerBounds.left,
          bottom,
          right: containerBounds.right
        },
        destination: {
          top: current.top,
          left: current.left,
          bottom: current.bottom,
          right: current.right
        }
      });
    }

    const firstChildBounds = existingElementsBounds[0];
    assert(
      firstChildBounds,
      "Must always have at least one element in character tray"
    );

    const outerDragBounds = Array.from(innerDragBounds);
    outerDragBounds.unshift({
      dropBounds: {
        top: containerBounds.top - GRID_SIZE_PX,
        left: containerBounds.left,
        bottom: containerBounds.top,
        right: containerBounds.right
      },
      destination: {
        top: containerBounds.top - GRID_SIZE_PX,
        left: firstChildBounds.left,
        bottom: containerBounds.top,
        right: firstChildBounds.right
      }
    });

    return {
      innerDrag: innerDragBounds,
      outerDrag: outerDragBounds
    };
  }, [itemRefs]);

  return (
    <Paper className={classes.tokenSheet} ref={containerRef}>
      <SortableList id={DROPPABLE_ID} items={items} getTargets={getTargets}>
        {(item, isDragging, attributes) => (
          <Character
            icon={item.icon}
            isDragging={isDragging}
            onContextMenu={e => {
              e.preventDefault();
              if (items.length > 2) {
                onIconRemoved(item.icon);
              }
            }}
            {...attributes}
            ref={(el: HTMLElement) => {
              itemRefs.get(item.icon.id)!.current = el;
              attributes.ref.current = el;
            }}
          />
        )}
      </SortableList>
    </Paper>
  );
});

export default CharacterTray;
