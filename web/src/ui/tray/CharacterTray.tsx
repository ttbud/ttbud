import React from "react";
import { makeStyles, Paper } from "@material-ui/core";
import SortableList from "../sort/SortableList";
import { DROPPABLE_IDS } from "../DropIds";
import { DraggableType, IconDraggable } from "../../drag/DragStateTypes";
import { Icon } from "../icons";
import Character from "../token/Character";

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
}

const CharacterTray: React.FC<Props> = ({ icons }) => {
  const classes = useStyles();

  const items = icons.map(icon => ({
    icon,
    descriptor: {
      type: DraggableType.ICON,
      id: `${DROPPABLE_ID}-${icon.id}`,
      icon: icon
    } as IconDraggable
  }));

  return (
    <Paper className={classes.tokenSheet}>
      <SortableList id={DROPPABLE_ID} items={items}>
        {(item, isDragging, attributes) => (
          <Character icon={item.icon} isDragging={isDragging} {...attributes} />
        )}
      </SortableList>
    </Paper>
  );
};

export default CharacterTray;
