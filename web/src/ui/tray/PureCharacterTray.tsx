import makeStyles from "@mui/styles/makeStyles";
import React, { memo, useMemo } from "react";
import { TokenBlueprint } from "./types";
import { useDroppable } from "@dnd-kit/core";
import { Paper } from "@mui/material";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Sortable from "../drag/Sortable";
import Character from "../token/Character";
import { removeCharacter } from "./character-tray-slice";
import { DROPPABLE_IDS } from "../DroppableIds";
import { DragDescriptor } from "../drag/types";

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

interface Props {
  items: TrayItem[];
  onRemoveBlueprint: (id: string) => void;
}

interface TrayItem {
  id: string;
  descriptor: DragDescriptor;
}

const PureCharacterTray: React.FC<Props> = memo(
  ({ items, onRemoveBlueprint }) => {
    const classes = useStyles();

    const { setNodeRef } = useDroppable({ id: DROPPABLE_IDS.CHARACTER_TRAY });

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
                      onRemoveBlueprint(items[idx].id);
                    }
                  }}
                />
              </Sortable>
            );
          })}
        </SortableContext>
      </Paper>
    );
  }
);

export default PureCharacterTray;
