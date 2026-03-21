import React, { CSSProperties } from "react";
import { makeStyles } from "@material-ui/core";
import clsx from "clsx";
import { GRID_SIZE_PX } from "../../config";
import Pos2d, { HEX_HEIGHT } from "../../util/shape-math";
import { Icon } from "../icons";
import { GridType } from "../../types";

interface Props {
  icon: Icon;
  pos: Pos2d;
  gridType: GridType;
}

const useStyles = makeStyles({
  media: ({ gridType }: Props) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: gridType === GridType.Hex ? GRID_SIZE_PX * 0.9 : GRID_SIZE_PX,
    height: gridType === GridType.Hex ? HEX_HEIGHT * 0.9 : GRID_SIZE_PX,
    userSelect: "none",
    userDrag: "none",
    backgroundColor: "transparent",
  }),
  hex: {
    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
});

const FloorIcon: React.FC<Props> = (props) => {
  const { icon, pos, gridType } = props;
  const classes = useStyles(props);

  const style: CSSProperties = {
    position: "absolute",
    top: gridType === GridType.Hex ? pos.y + (HEX_HEIGHT * 0.1) / 2 : pos.y,
    left: gridType === GridType.Hex ? pos.x + (GRID_SIZE_PX * 0.1) / 2 : pos.x,
    backgroundImage: `url(${icon.img})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    zIndex: 0,
  };

  return (
    <div
      style={style}
      className={clsx(classes.media, gridType === GridType.Hex && classes.hex)}
      role={"img"}
      aria-label={`Floor: ${icon.desc}`}
    />
  );
};

export default FloorIcon;
