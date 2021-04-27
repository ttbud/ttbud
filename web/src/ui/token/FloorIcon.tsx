import React, { CSSProperties } from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX, GRID_SIZE_PX_X, GRID_SIZE_PX_Y } from "../../config";
import Pos2d from "../../util/shape-math";
import { Icon } from "../icons";

interface Props {
  icon: Icon;
  pos: Pos2d;
}

const useStyles = makeStyles({
  media: {
    marginLeft: 10,
    marginTop: 5,
    width: 60,
    height: 60,
    clipPath: "polygon(26% 1%, 74% 1%, 99% 50%, 74% 99%, 26% 99%, 1% 50%)",
    userSelect: "none",
  },
});

const FloorIcon: React.FC<Props> = ({ icon, pos }) => {
  const classes = useStyles();

  const style: CSSProperties = {
    position: "absolute",
    top: pos.y,
    left: pos.x,
    backgroundImage: `url(${icon.img})`,
    zIndex: 0,
  };

  // Using an actual image element here makes it so sometimes if you click and
  // drag over the icon you get the "image dragging" ui that browsers provide.
  // Setting draggable to false or user-drag to none on this or its parent
  // does not prevent this from happening, so instead we use a background image.
  return (
    <div
      style={style}
      className={classes.media}
      role={"img"}
      aria-label={`Floor: ${icon.desc}`}
    />
  );
};

export default FloorIcon;
