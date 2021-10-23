import { Paper } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { memo, useMemo, useRef } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Sortable from "../drag/Sortable";
import Character from "../token/Character";
import useDropMonitor from "../drag/useDropMonitor";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/rootReducer";
import { TokenBlueprint } from "./types";
import {
  addCharacter,
  moveCharacter,
  removeCharacter,
  renewCharacter,
} from "./character-tray-slice";
import { DragOverEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { isSortableData } from "../drag/types";

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

const CharacterTray: React.FC = memo(() => {
  const classes = useStyles();

  const blueprints = useSelector<RootState, TokenBlueprint[]>(
    (state) => state.characterTray.characterBlueprints
  );
  const dispatch = useDispatch();

  const items = useMemo(() => {
    return blueprints.map((bp) => ({
      id: bp.id,
      descriptor: {
        type: "character",
        contents: bp.contents,
        source: "character tray",
      } as const,
    }));
  }, [blueprints]);

  const { setNodeRef } = useDroppable({ id: "character tray" });

  useDndMonitor({
    onDragOver(event: DragOverEvent) {
      if (
        event.over?.id === "character tray" ||
        (isSortableData(event.over?.data) &&
          event.over?.data.sortable?.containerId === "character tray")
      ) {
        if (!items.some((item) => item.id === event.active.id)) {
        }
      }
    },
  });

  useDropMonitor("character tray", (event) => {
    switch (event.type) {
      case "dropped into":
        dispatch(
          addCharacter({
            idx: event.toIdx!,
            blueprint: {
              id: event.dragId,
              contents: event.descriptor.contents,
            },
          })
        );
        break;
      case "moved inside":
        dispatch(
          moveCharacter({
            toIdx: event.toIdx!,
            fromIdx: event.fromIdx!,
          })
        );
        break;
      case "dragged from":
        dispatch(renewCharacter(event.fromIdx!));
        break;
      default:
        throw new UnreachableCaseError(event);
    }
  });

  return (
    <Paper
      className={classes.tokenSheet}
      ref={setNodeRef}
      data-tour="character-tray"
      aria-label="Character Tray"
    >
      <SortableContext
        key="character tray"
        id="character tray"
        items={items}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, idx) => {
          return (
            <Sortable key={item.id} id={item.id} data={item.descriptor}>
              <Character
                contents={item.descriptor.contents}
                onDelete={() => {
                  if (items.length > 2) {
                    dispatch(removeCharacter(idx));
                  }
                }}
              />
            </Sortable>
          );
        })}
      </SortableContext>
    </Paper>
  );
});

export default CharacterTray;
