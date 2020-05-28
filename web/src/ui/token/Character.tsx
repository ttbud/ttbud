import React, { memo, MouseEvent, useEffect, useState } from "react";
import {
  Card,
  CardMedia,
  Divider,
  Fade,
  makeStyles,
  Theme,
} from "@material-ui/core";
import clsx from "clsx";
import { Icon, ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { Color, ContentType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { DragAttributes } from "../../drag/Draggable";
import { Pos3d } from "../../util/shape-math";
import CardActions from "@material-ui/core/CardActions";
import IconButton from "@material-ui/core/IconButton";
import PaletteIcon from "@material-ui/icons/Palette";
import ResizeIcon from "@material-ui/icons/Crop";

interface StyleProps {
  expanded: boolean;
  pos?: Pos3d;
  color?: Color;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  character: ({ pos, color, expanded }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: expanded ? GRID_SIZE_PX + 84 : GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    zIndex: expanded ? 10_000 : pos?.z,
    border: `3px solid ${toCssColor(color)}`,
    transition: theme.transitions.create(["width", "box-shadow"], {
      duration: theme.transitions.duration.short,
    }),
  }),
  media: {
    margin: theme.spacing(1),
    width: GRID_SIZE_PX * 0.7,
    height: GRID_SIZE_PX * 0.7,
  },
  divider: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  actions: ({ expanded }) => ({
    transition: theme.transitions.create("width", {
      duration: theme.transitions.duration.short,
    }),
    width: expanded ? 84 : 0,
  }),
}));

interface Props {
  contents: TokenContents;
  expandable?: boolean;
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

const HOVER_EXPAND_DELAY_MS = 600;

const Character: React.FC<Props> = memo(
  ({
    contents,
    expandable = false,
    color,
    pos,
    isDragging,
    className,
    dragAttributes,
    onDelete,
  }) => {
    const [expanded, setExpanded] = useState(false);
    const [hovering, setHovering] = useState(false);

    const classes = useStyles({ pos, color, expanded });

    useEffect(() => {
      if (expandable && hovering && !isDragging) {
        const timeoutId = setTimeout(
          () => setExpanded(true),
          HOVER_EXPAND_DELAY_MS
        );
        return () => clearTimeout(timeoutId);
      } else {
        setExpanded(false);
      }
    }, [hovering, isDragging, expandable]);

    const renderContents = (
      contents: TokenContents,
      dragAttributes: Pick<DragAttributes, "onPointerDown" | "style" | "ref">
    ) => {
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

    const renderIcon = (
      icon: Icon,
      dragAttributes: Pick<DragAttributes, "onPointerDown" | "style" | "ref">
    ) => {
      return (
        <div {...dragAttributes}>
          <CardMedia
            className={classes.media}
            image={icon.img}
            aria-label={`Character: ${icon.desc}`}
            draggable={false}
          />
        </div>
      );
    };

    const onContextMenu = (e: MouseEvent) => {
      if (onDelete) {
        e.preventDefault();
        onDelete();
      }
    };

    const style = dragAttributes?.style;

    return (
      <Card
        onContextMenu={onContextMenu}
        raised={isDragging || hovering}
        className={clsx(classes.character, className)}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onTransitionEnd={dragAttributes?.onTransitionEnd}
        ref={dragAttributes?.ref}
        style={{
          position: style?.position ?? pos ? "absolute" : "static",
          top: pos?.y,
          left: pos?.x,
          userSelect: style?.userSelect,
          transform: style?.transform,
          transition: style?.transition,
          zIndex: style?.zIndex,
        }}
      >
        {renderContents(contents, {
          ref: dragAttributes?.handleRef ?? null,
          onPointerDown: dragAttributes?.onPointerDown,
          style: { cursor: dragAttributes?.style?.cursor },
        })}
        <Fade in={expanded && !isDragging}>
          <Divider
            className={classes.divider}
            orientation={"vertical"}
            flexItem
          />
        </Fade>
        <div
          className={classes.actions}
          style={{ width: !isDragging && expanded ? 84 : 0 }}
        >
          <CardActions>
            <IconButton aria-label="choose character color" size={"small"}>
              <PaletteIcon />
            </IconButton>
            <IconButton aria-label="resize" size={"small"}>
              <ResizeIcon />
            </IconButton>
          </CardActions>
        </div>
      </Card>
    );
  }
);

export default Character;
