import React, { memo, MouseEvent } from "react";
import { Card, CardMedia, Theme } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import clsx from "clsx";
import { Icon, ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { Color, ContentType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { Pos3d } from "../../util/shape-math";

const useStyles = makeStyles<Theme, Props>((_) => ({
  "@keyframes raise": {
    from: {
      boxShadow: `
        0px 2px 1px -1px rgb(0 0 0 / 20%),
        0px 1px 1px 0px rgb(0 0 0 / 14%),
        0px 1px 3px 0px rgb(0 0 0 / 12%)
      `,
    },
    to: {
      boxShadow: `
        0px 5px 5px -3px rgb(0 0 0 / 20%),
        0px 8px 10px 1px rgb(0 0 0 / 12%),
        0px 3px 14px 2px rgb(0 0 0 / 12%)
      `,
    },
  },
  raising: {
    animation: "$raise 300ms both cubic-bezier(0.4, 0, 0.2, 1) 0ms",
  },
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
}));

interface Props {
  contents: TokenContents;
  color?: Color;
  onDelete?: () => void;
  className?: string;
  pos?: Pos3d;
  raise?: boolean;
}

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const Character: React.FC<Props> = memo((props) => {
  const classes = useStyles(props);
  const { raise, contents, className, onDelete } = props;

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
      /* istanbul ignore next */
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

  const cardClasses = clsx(classes.character, className, {
    [classes.raising]: raise,
  });

  if (!contents) {
    debugger;
  }

  return (
    <Card onContextMenu={onContextMenu} className={cardClasses}>
      {renderContents(contents)}
    </Card>
  );
});

export default Character;
