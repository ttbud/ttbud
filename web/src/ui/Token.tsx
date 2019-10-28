import React, { useRef, useState } from "react";
import Draggable from "react-draggable";
import { Card, CardMedia, makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";

const PADDING = GRID_SIZE_PX / 5;
const CARD_SIZE = GRID_SIZE_PX - PADDING * 2;
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

interface Pos {
  x: number;
  y: number;
}

interface Props {
  icon: string;
  pos?: Pos;
  onDropped: (x: number, y: number) => void;
}

const Token: React.FC<Props> = (props: Props) => {
  const classes = useStyles();
  const [isDragging, setDragging] = useState();
  const ref = useRef<HTMLElement>();
  const style = isDragging ? { zIndex: 1000 } : {};

  return (
    <Draggable
      offsetParent={document.body}
      position={props.pos}
      onMouseDown={e => {
        if (e.button === 0) {
          setDragging(true);
          e.stopPropagation();
        }
      }}
      onStop={(event, data) => {
        setDragging(false);
        const rect = data.node.getBoundingClientRect();
        props.onDropped(rect.left, rect.top);
      }}
    >
      <Card
        style={style}
        className={classes.card}
        raised={isDragging}
        ref={ref}
      >
        <CardMedia className={classes.media} image={props.icon} />
      </Card>
    </Draggable>
  );
};

export default Token;
