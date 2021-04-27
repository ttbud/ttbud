import React, { memo, MouseEvent } from "react";
import { Card, CardMedia, makeStyles, Theme } from "@material-ui/core";
import clsx from "clsx";
import { Icon, ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { Color, ContentType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { DragAttributes } from "../../drag/Draggable";
import { Pos3d } from "../../util/shape-math";

const useStyles = makeStyles<Theme, Props>({
  container: ({ color }) => ({
    filter: "drop-shadow(16px 16px 20px gray)",
    border: `3px solid ${toCssColor(color)}`,
  }),
  character: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: 80,
    height: 70,
    clipPath: "polygon(26% 1%, 74% 1%, 99% 50%, 74% 99%, 26% 99%, 1% 50%)",
  },
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
  pos?: Pos3d;
  isDragging?: boolean;
  dragAttributes?: DragAttributes;
}

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const Character: React.FC<Props> = memo((props) => {
  const classes = useStyles(props);
  const {
    isDragging,
    contents,
    className,
    dragAttributes,
    onDelete,
    pos,
  } = props;

  const renderContents = (contents: TokenContents) => {
    switch (contents.type) {
      case ContentType.Icon:
        const icon = ICONS_BY_ID.get(contents.iconId);
        if (icon) {
          return renderIcon(icon);
        } else {
          console.warn(`Invalid icon id ${contents.iconId}`);
          return "?";
        }
      case ContentType.Text:
        return contents.text.toLocaleUpperCase();
      default:
        throw new UnreachableCaseError(contents);
    }
  };

  const renderIcon = (icon: Icon) => {
    return (
      <CardMedia
        className={classes.media}
        image={icon.img}
        aria-label={`Character: ${icon.desc}`}
        draggable={false}
      />
    );
  };

  const onContextMenu = (e: MouseEvent) => {
    if (onDelete) {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <div
      className={classes.container}
      style={{
        position: pos ? "absolute" : "static",
        top: pos?.y,
        left: pos?.x,
        zIndex: pos?.z,
        ...dragAttributes?.style,
      }}
      {...dragAttributes}
    >
      <Card
        onContextMenu={onContextMenu}
        raised={isDragging}
        className={clsx(classes.character, className)}
      >
        {renderContents(contents)}
      </Card>
    </div>
  );
});

export default Character;
