import React, { CSSProperties } from "react";
import { makeStyles } from "@material-ui/core";
import clsx from "clsx";
import { GRID_SIZE_PX } from "../../config";
import Pos2d, { HEX_HEIGHT, HEX_WIDTH } from "../../util/shape-math";
import { GridType } from "../../types";

interface Props {
  text: string;
  pos: Pos2d;
  gridType: GridType;
}

const useStyles = makeStyles({
  media: ({ gridType }: Props) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: gridType === GridType.Hex ? HEX_WIDTH : GRID_SIZE_PX,
    height: gridType === GridType.Hex ? HEX_HEIGHT : GRID_SIZE_PX,
    userSelect: "none",
    userDrag: "none",
  }),
  hex: {
    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
});

const FloorText: React.FC<Props> = (props) => {
  const { text, pos, gridType } = props;
  const classes = useStyles(props);

  const style: CSSProperties = {
    position: "absolute",
    top: pos.y,
    left: pos.x,
    zIndex: 0,
  };

  return (
    <div
      style={style}
      className={clsx(classes.media, gridType === GridType.Hex && classes.hex)}
    >
      {text.toLocaleUpperCase()}
    </div>
  );
};

export default FloorText;
