import { makeStyles, Paper } from "@material-ui/core";
import React, { createRef, memo, useMemo, useRef, useCallback } from "react";
import {
  DraggableType,
  TokenBlueprintDraggable,
} from "../../drag/DragStateTypes";
import { DROPPABLE_IDS } from "../DroppableIds";
import SortableList, { Targets, Target } from "../sort/SortableList";
import Character from "../token/Character";
import { assert } from "../../util/invariants";
import { GRID_SIZE_PX } from "../../config";
import { RootState } from "../../store/rootReducer";
import { removeCharacter } from "./character-tray-slice";
import { connect } from "react-redux";
import { contentId, TokenContents } from "../../types";
import assignRef from "../../util/assignRef";

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
  blueprints: TokenContents[];
  onCharacterRemoved: (character: TokenContents) => void;
}

const mapStateToProps = (state: RootState) => ({
  blueprints: state.characterTray.characterBlueprints,
});

const dispatchProps = { onCharacterRemoved: removeCharacter };

const PureCharacterTray: React.FC<Props> = memo(function CharacterTray({
  blueprints,
  onCharacterRemoved,
}) {
  const classes = useStyles();

  const items = blueprints.map((blueprint) => ({
    blueprint,
    descriptor: {
      type: DraggableType.TokenBlueprint,
      id: `${DROPPABLE_ID}-${contentId(blueprint)}`,
      contents: blueprint,
    } as TokenBlueprintDraggable,
  }));

  const containerRef = useRef<HTMLElement>();

  const blueprintRefs = useMemo(() => {
    const refs = new Map<string, React.MutableRefObject<HTMLElement | null>>();
    for (const blueprint of blueprints) {
      refs.set(contentId(blueprint), createRef<HTMLElement>());
    }
    return refs;
  }, [blueprints]);

  const getTargets = useCallback((): Targets => {
    const existingElementsBounds = [];
    for (const itemRef of blueprintRefs.values()) {
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
  }, [blueprintRefs]);

  return (
    <Paper
      className={classes.tokenSheet}
      ref={containerRef}
      aria-label={"Character Tray"}
    >
      <SortableList id={DROPPABLE_ID} items={items} getTargets={getTargets}>
        {(item, isDragging, attributes) => (
          <Character
            contents={item.blueprint}
            isDragging={isDragging}
            dragAttributes={{
              ...attributes,
              ref: (el: HTMLElement) => {
                blueprintRefs.get(contentId(item.blueprint))!.current = el;
                assignRef(attributes?.ref, el);
              },
            }}
            onDelete={() => {
              if (items.length > 2) {
                onCharacterRemoved(item.blueprint);
              }
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
