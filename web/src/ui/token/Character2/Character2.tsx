import React, { MouseEvent, memo, useCallback, useState } from "react";
import { Card, makeStyles, Theme } from "@material-ui/core";
import clsx from "clsx";
import { GRID_SIZE_PX } from "../../../config";
import {
  Color,
  ContentType,
  IconContents,
  TokenContents,
} from "../../../types";
import CharacterContents from "./CharacterContents";
import { shallowEqual } from "react-redux";
import { STACK_ICON } from "../../icons";

interface StyleProps {
  color: Color | undefined;
}

const useStyles = makeStyles<Theme, StyleProps>({
  character: ({ color }) => {
    return {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      width: GRID_SIZE_PX,
      height: GRID_SIZE_PX,
      userDrag: "none",
      userSelect: "none",
      border: `3px solid ${toCssColor(color)}`,
    };
  },
  media: {
    width: "70%",
    height: "70%",
  },
});

interface Props {
  contents: TokenContents;
  color?: Color;
  isBottomOfStack?: boolean;
  isInStack?: boolean;
  onDelete?: () => void;
  className?: string;
}

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const Character2: React.FC<Props> = memo((props) => {
  const { contents, className, onDelete, isBottomOfStack, color, isInStack } =
    props;
  const classes = useStyles({ color });

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
      style={{ position: "relative" }}
    >
      {isInStack && !isBottomOfStack && (
        <img
          src={STACK_ICON.img}
          style={{ position: "absolute", top: 0, right: 0 }}
          alt="THIS IS A STACK"
          width="10px"
          height="10px"
        />
      )}
      <CharacterContents contents={contents} />
    </Card>
  );
}, shallowEqual);

export default Character2;
