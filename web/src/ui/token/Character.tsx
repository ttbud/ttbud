import React, { memo, MouseEvent, useEffect, useState } from "react";
import {
  Backdrop,
  Card,
  CardMedia,
  Divider,
  Fade,
  makeStyles,
  Theme,
  useTheme,
} from "@material-ui/core";
import clsx from "clsx";
import { Icon, ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { Color, ContentType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { DragAttributes } from "../../drag/Draggable";
import { Bounds, Pos3d } from "../../util/shape-math";
import CardActions from "@material-ui/core/CardActions";
import IconButton from "@material-ui/core/IconButton";
import PaletteIcon from "@material-ui/icons/Palette";
import ResizeIcon from "@material-ui/icons/Crop";

interface StyleProps {
  resizing: boolean;
  expanded: boolean;
  color?: Color;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  character: ({ color, expanded, resizing }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    cursor: resizing ? "nwse-resize" : undefined,
    width: expanded ? GRID_SIZE_PX + 84 : GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    border: `3px solid ${toCssColor(color)}`,
    // transition: theme.transitions.create(["width", "box-shadow"], {
    //   duration: theme.transitions.duration.short,
    // }),
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
  resizeIndicator: {
    position: "absolute",
    bottom: -4,
    right: -1,
    // Makes a triangle facing to down and right
    width: 0,
    height: 0,
    borderTop: "6px solid transparent",
    borderBottom: "6px solid transparent",
    borderLeft: "6px solid gray",
    transform: "rotate(45deg)",
  },
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
    const [resizeModeActive, setResizeModeActive] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [width, setWidth] = useState(GRID_SIZE_PX);
    const [height, setHeight] = useState(GRID_SIZE_PX);
    const theme = useTheme();

    const classes = useStyles({ color, expanded, resizing: resizeModeActive });

    useEffect(() => {
      if (expandable && hovering && !isDragging && !resizeModeActive) {
        const timeoutId = setTimeout(
          () => setExpanded(true),
          HOVER_EXPAND_DELAY_MS
        );
        return () => clearTimeout(timeoutId);
      } else {
        setExpanded(false);
      }
    }, [resizeModeActive, hovering, isDragging, expandable]);

    useEffect(() => {
      if (expanded && !isDragging) {
        const listener = () => {
          console.log("called");
          setResizeModeActive(false);
        };
        window.addEventListener("click", listener);
        return () => window.removeEventListener("click", listener);
      }
    }, [expanded, isDragging]);

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

    const onContextMenu = (e: MouseEvent) => {
      if (onDelete) {
        e.preventDefault();
        onDelete();
      }
    };

    const onResizeClicked = () => {
      setExpanded(false);
      setResizeModeActive(true);
    };

    const renderIcon = (
      icon: Icon,
      dragAttributes: Pick<DragAttributes, "onPointerDown" | "style" | "ref">
    ) => {
      return (
        <div
          {...dragAttributes}
          style={{
            width: width,
            height: height,
          }}
        >
          <CardMedia
            className={classes.media}
            image={icon.img}
            aria-label={`Character: ${icon.desc}`}
            draggable={false}
            style={{
              width: "60%",
              height: "60%",
            }}
          />
        </div>
      );
    };

    const onPointerDown = (e: MouseEvent) => {
      if (resizeModeActive) {
        setResizing(true);
      }
    };

    useEffect(() => {
      if (resizing) {
        assert(pos, "Cannot resize un-positioned card");
        const startBounds: Bounds = {
          top: pos.y,
          left: pos.x,
          bottom: pos.y + GRID_SIZE_PX,
          right: pos.x + GRID_SIZE_PX,
        };

        const onPointerMove = (e: PointerEvent) => {
          setWidth(Math.max(e.clientX - startBounds.left, GRID_SIZE_PX));
          setHeight(Math.max(e.clientY - startBounds.top, GRID_SIZE_PX));
        };

        const onPointerUp = () => {
          setWidth(GRID_SIZE_PX);
          setHeight(GRID_SIZE_PX);
          setResizing(false);
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);

        return () => {
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
        };
      }
    }, [resizing, pos]);

    const style = dragAttributes?.style;

    const renderCharacter = () => (
      <>
        <Backdrop
          style={{ zIndex: 5 }}
          open={resizeModeActive}
          onClick={() => setResizeModeActive(false)}
        />
        <Card
          onContextMenu={onContextMenu}
          raised={isDragging || hovering || resizeModeActive}
          className={clsx(classes.character, className)}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          onPointerDown={onPointerDown}
          onTransitionEnd={dragAttributes?.onTransitionEnd}
          ref={dragAttributes?.ref}
          style={{
            position: style?.position ?? pos ? "absolute" : "relative",
            top: pos?.y,
            left: pos?.x,
            zIndex:
              style?.zIndex ?? (expanded || resizeModeActive) ? 10_000 : pos?.z,
            userSelect: style?.userSelect,
            transform: style?.transform,
            transition:
              style?.transition ?? !resizing
                ? theme.transitions.create(["width", "height", "box-shadow"], {
                    duration: theme.transitions.duration.short,
                  })
                : undefined,
          }}
        >
          {renderContents(contents, {
            ref: dragAttributes?.handleRef ?? null,
            onPointerDown: !resizeModeActive
              ? dragAttributes?.onPointerDown
              : undefined,
            style: {
              cursor: dragAttributes?.style?.cursor,
            },
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
            style={{
              width: isDragging || !expanded ? 0 : 84,
              visibility: resizeModeActive ? "collapse" : "visible",
            }}
          >
            <CardActions>
              <IconButton aria-label="choose character color" size={"small"}>
                <PaletteIcon />
              </IconButton>
              <IconButton
                aria-label="resize"
                size={"small"}
                onClick={onResizeClicked}
              >
                <ResizeIcon />
              </IconButton>
            </CardActions>
          </div>
        </Card>
      </>
    );

    return renderCharacter();
  }
);

export default Character;
