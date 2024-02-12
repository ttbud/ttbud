import { makeStyles, Paper } from "@material-ui/core";
import React, { memo, useRef } from "react";
import { TokenContents } from "../../types";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";
import Character2 from "../token/Character2/Character2";
import { LocationType } from "../../drag/DragStateTypes";
import { useDroppable } from "@dnd-kit/core";
import { shallowEqual } from "react-redux";

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

export interface Blueprint {
  id: string;
  contents: TokenContents;
}

interface Props {
  items: Blueprint[];
  onCharacterRemoved: (character: TokenContents) => void;
}

const CharacterTray2: React.FC<Props> = memo(
  ({ items, onCharacterRemoved }) => {
    const classes = useStyles();

    return (
      <Paper
        className={classes.tokenSheet}
        elevation={4}
        data-tour={"character-tray"}
        aria-label={"Character Tray"}
      >
        <SortableContext
          items={items}
          id="character-tray"
          strategy={verticalListSortingStrategy}
        >
          {items.map((item, idx) => (
            <SortableItem
              id={item.id}
              key={item.id}
              descriptor={{
                contents: item.contents,
                origin: {
                  containerId: "character-tray",
                  location: { type: LocationType.List, idx },
                },
              }}
            >
              <Character2 contents={item.contents} />
            </SortableItem>
          ))}
        </SortableContext>
      </Paper>
    );
  },
  shallowEqual
);

export default CharacterTray2;
