import { Icon } from "../icons";
import React, { CSSProperties } from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";

interface Props {
  icon: Icon;
  pos: Pos;
}

interface Pos {
  x: number;
  y: number;
  z: number;
}

const useStyles = makeStyles({
  media: {
    width: GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    userSelect: "none"
  }
});

const FloorToken: React.FC<Props> = (props: Props) => {
  const classes = useStyles();
  const style: CSSProperties = {
    position: "absolute",
    top: props.pos.y,
    left: props.pos.x,
    backgroundImage: `url(${props.icon.img})`,
    zIndex: 0
  };
  // Using an actual image element here makes it so sometimes if you click and
  // drag over the icon you get the "image dragging" ui that browsers provide.
  // Setting draggable to false or user-drag to none on this or its parent
  // does not prevent this from happening, so instead we use a background image.
  return <div style={style} className={classes.media} />;
};

export default FloorToken;
