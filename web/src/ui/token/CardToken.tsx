import React, { useRef, useState } from "react";
import Draggable from "react-draggable";
import { Card, CardMedia, makeStyles } from "@material-ui/core";
import { CARD_PADDING, CARD_SIZE } from "../../config";
import { Icon } from "../icons";

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
  onDropped: (x: number, y: number) => void;
}

const CardToken: React.FC<Props> = (props: Props) => {
  const classes = useStyles();
  const [isDragging, setDragging] = useState();
  const ref = useRef<HTMLElement>();
  const style = isDragging ? { zIndex: 1000 } : { zIndex: props.pos.z };

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
