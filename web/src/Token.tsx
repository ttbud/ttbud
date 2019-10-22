import React, { useState } from "react";
import Draggable from "react-draggable";
import { Card, CardMedia, makeStyles } from "@material-ui/core";
import {GRID_SIZE_PX} from "./config";

const PADDING = GRID_SIZE_PX / 5;
const CARD_SIZE = GRID_SIZE_PX - (PADDING * 2);
const useStyles = makeStyles({
  card: {
    cursor: "pointer",
    width: CARD_SIZE,
    height: CARD_SIZE,
    padding: PADDING
  },
  media: {
    width: CARD_SIZE,
    height: CARD_SIZE
  },
  content: {
    fontSize: "12sp"
  }
});

interface Props {
  icon: string;
  x: number;
  y: number;
  onMoved: (x: number, y: number) => void;
}

const App = (props: Props) => {
  const classes = useStyles();
  const [isDragging, setDragging] = useState();

  return (
    <Draggable
      position={{ x: props.x, y: props.y }}
      onMouseDown={() => {
        setDragging(true);
      }}
      onStop={(event, data) => {
        setDragging(false);
        props.onMoved(data.x, data.y);
      }}
    >
      <Card className={classes.card} raised={isDragging}>
        <CardMedia className={classes.media} image={props.icon} />
      </Card>
    </Draggable>
  );
};

export default App;
