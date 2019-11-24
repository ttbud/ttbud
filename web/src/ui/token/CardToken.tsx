import React, { useState } from "react";
import { Card, CardMedia, makeStyles } from "@material-ui/core";
import { CARD_PADDING, CARD_SIZE } from "../../config";
import { Icon } from "../icons";
import Draggable from "../Draggable";

const useStyles = makeStyles({
  card: {
    cursor: "pointer",
    width: CARD_SIZE,
    height: CARD_SIZE,
    padding: CARD_PADDING
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
  z: number;
}

interface Props {
  icon: Icon;
  pos: Pos;
  startWithDragAt?: Pos;
  offsetParent?: HTMLElement;
  onDropped?: (x: number, y: number) => void;
  onDragStart?: (e: MouseEvent) => void;
}

const CardToken: React.FC<Props> = props => {
  const classes = useStyles();
  const [isDragging, setDragging] = useState(!!props.startWithDragAt);
  const style = isDragging ? { zIndex: 1000 } : { zIndex: props.pos.z };

  const onDragStart = (e: MouseEvent) => {
    setDragging(true);
    if (props.onDragStart) {
      props.onDragStart(e);
    }
  };

  const onStop = ({ x, y }: { x: number; y: number }) => {
    setDragging(false);
    if (props.onDropped) {
      props.onDropped(x, y);
    }
  };

  return (
    <Draggable
      pos={props.pos}
      onDragStart={onDragStart}
      onDragStop={onStop}
      startWithDragAt={props.startWithDragAt}
    >
      <Card style={style} className={classes.card} raised={isDragging}>
        <CardMedia
          className={classes.media}
          image={props.icon.img}
          component={"div"}
        />
      </Card>
    </Draggable>
  );
};

export default CardToken;
