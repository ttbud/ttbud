import React, { memo, useCallback, useState } from "react";
import { Card, makeStyles, TextField, Theme } from "@material-ui/core";
import clsx from "clsx";
import { GRID_SIZE_PX } from "../../../config";
import { Color, TokenContents } from "../../../types";
import CharacterContents from "./CharacterContents";
import { shallowEqual } from "react-redux";

interface StyleProps {
  color?: Color;
  expanded: boolean;
}

const EXPANDED_WIDTH = 150;
const useStyles = makeStyles<Theme, StyleProps>({
  character: {
    boxSizing: "border-box",
    width: ({ expanded }) => (expanded ? EXPANDED_WIDTH : GRID_SIZE_PX),
    height: GRID_SIZE_PX,
    userDrag: "none",
    userSelect: "none",
    border: ({ color }) => `3px solid ${toCssColor(color)}`,
    transition: "width .2s, height .2s",
  },
  mediaWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Minus the border size
    width: GRID_SIZE_PX - 3 * 2,
    height: GRID_SIZE_PX - 3 * 2,
  },
  contentWrapper: {
    display: "flex",
    gap: 8,
    width: EXPANDED_WIDTH,
    height: GRID_SIZE_PX,
  },
  textInput: {
    width: 80,
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

const ExpandableCharacter: React.FC<Props> = memo(
  ({ contents, color, className }) => {
    const [hovering, setHovering] = useState(true);
    const classes = useStyles({ color, expanded: hovering });

    const onPointerEnter = useCallback(() => setHovering(true), []);
    const onPointerLeave = useCallback(() => setHovering(false), []);

    return (
      <Card
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={clsx(classes.character, className)}
      >
        <div className={classes.contentWrapper}>
          <div className={classes.mediaWrapper}>
            <CharacterContents contents={contents} />
          </div>
          <TextField size="small" className={classes.textInput} />
        </div>
      </Card>
    );
  },
  shallowEqual
);

export default ExpandableCharacter;
