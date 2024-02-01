import React, { MouseEvent, useCallback } from "react";
import { Card, makeStyles, Theme } from "@material-ui/core";
import clsx from "clsx";
import { GRID_SIZE_PX } from "../../../config";
import { Color, TokenContents } from "../../../types";
import CharacterContents from "./CharacterContents";

const useStyles = makeStyles<Theme, Props>({
  character: ({ color }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    userDrag: "none",
    userSelect: "none",
    border: `3px solid ${toCssColor(color)}`,
  }),
  media: {
    width: "70%",
    height: "70%",
  },
});

interface Props {
  contents: TokenContents;
  color?: Color;
  onDelete?: () => void;
  className?: string;
}

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const Character2: React.FC<Props> = (props) => {
  const classes = useStyles(props);
  const { contents, className, onDelete } = props;

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      if (onDelete) {
        e.preventDefault();
        onDelete();
      }
    },
    [onDelete]
  );

  return (
    <Card
      onContextMenu={onContextMenu}
      className={clsx(classes.character, className)}
    >
      <CharacterContents contents={contents} />
    </Card>
  );
};

export default Character2;
