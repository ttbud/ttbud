import { makeStyles, Paper } from "@material-ui/core";
import React, { createRef, memo, useMemo, useRef, useCallback } from "react";
import { DraggableType, TokenSourceDraggable } from "../../drag/DragStateTypes";
import { DROPPABLE_IDS } from "../DroppableIds";
import SortableList, { Targets, Target } from "../sort/SortableList";
import Character from "../token/Character";
import { assert } from "../../util/invariants";
import { GRID_SIZE_PX } from "../../config";
import { RootState } from "../../store/rootReducer";
import { removeTokenSource } from "./character-tray-slice";
import { connect } from "react-redux";
import { contentId, TokenContents } from "../../types";

const useStyles = makeStyles((theme) => ({
  tokenSheet: {
    backgroundColor: "#cccccc",
    padding: theme.spacing(1),
    "& div": {
      marginBottom: theme.spacing(1),
    },
    "& div:last-child": {
      marginBottom: 0,
    },
  },
}));

const DROPPABLE_ID = DROPPABLE_IDS.CHARACTER_TRAY;

interface Props {
  sources: TokenContents[];
  onSourceRemoved: (source: TokenContents) => void;
}

const mapStateToProps = (state: RootState) => ({
  sources: state.characterTray.characterSources,
});

const dispatchProps = { onSourceRemoved: removeTokenSource };

const PureCharacterTray: React.FC<Props> = memo(function CharacterTray({
  sources,
  onSourceRemoved,
}) {
  const classes = useStyles();

  const items = sources.map((source) => ({
    source,
    descriptor: {
      type: DraggableType.TokenSource,
      id: `${DROPPABLE_ID}-${contentId(source)}`,
      contents: source,
    } as TokenSourceDraggable,
  }));

  const containerRef = useRef<HTMLElement>();

  const sourceRefs = useMemo(() => {
    const refs = new Map<string, React.MutableRefObject<HTMLElement | null>>();
    for (const source of sources) {
      refs.set(contentId(source), createRef<HTMLElement>());
    }
    return refs;
  }, [sources]);

  const getTargets = useCallback((): Targets => {
    const existingElementsBounds = [];
    for (const itemRef of sourceRefs.values()) {
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
          right: containerBounds.right,
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
      "Must always have at least one element in character tray"
    );

    const outerDragBounds = Array.from(innerDragBounds);
    outerDragBounds.unshift({
      dropBounds: {
        top: containerBounds.top - GRID_SIZE_PX,
        left: containerBounds.left,
        bottom: containerBounds.top,
        right: containerBounds.right,
      },
      destination: {
        top: containerBounds.top - GRID_SIZE_PX,
        left: firstChildBounds.left,
        bottom: containerBounds.top,
        right: firstChildBounds.right,
      },
    });

    return {
      innerDrag: innerDragBounds,
      outerDrag: outerDragBounds,
    };
  }, [sourceRefs]);

  return (
    <Paper
      className={classes.tokenSheet}
      ref={containerRef}
      aria-label={"Character Tray"}
    >
      <SortableList id={DROPPABLE_ID} items={items} getTargets={getTargets}>
        {(item, isDragging, attributes) => (
          <Character
            contents={item.source}
            isDragging={isDragging}
            onContextMenu={(e) => {
              e.preventDefault();
              if (items.length > 2) {
                onSourceRemoved(item.source);
              }
            }}
            {...attributes}
            ref={(el: HTMLElement) => {
              sourceRefs.get(contentId(item.source))!.current = el;
              attributes.ref.current = el;
            }}
          />
        )}
      </SortableList>
    </Paper>
  );
});

const CharacterTray = connect(
  mapStateToProps,
  dispatchProps
)(PureCharacterTray);

export default CharacterTray;
export { PureCharacterTray };
