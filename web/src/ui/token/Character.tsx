import React, { memo, MouseEvent } from "react";
import { makeStyles } from "@material-ui/core";
import clsx from "clsx";
import { Icon, ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { Color, ContentType, GridType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { DragAttributes } from "../../drag/Draggable";
import { Pos3d, HEX_HEIGHT } from "../../util/shape-math";

interface Props {
  contents: TokenContents;
  color?: Color;
  onDelete?: () => void;
  className?: string;
  pos?: Pos3d;
  isDragging?: boolean;
  dragAttributes?: DragAttributes;
  gridType?: GridType;
}

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const useStyles = makeStyles({
  characterContainer: {
    width: GRID_SIZE_PX,
    height: (props: Props) =>
      props.gridType === GridType.Hex ? HEX_HEIGHT : GRID_SIZE_PX,
  },
  character: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    WebkitUserDrag: "none",
    userSelect: "none",
    width: "100%",
    height: "100%",
    border: (props: Props) =>
      props.gridType === GridType.Square
        ? `3px solid ${toCssColor(props.color)}`
        : "none",
  },
  square: {
    borderRadius: 4,
  },
  hex: {
    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
  paper: {
    backgroundColor: "#fff",
    color: "rgba(0, 0, 0, 0.87)",
    boxShadow:
      "0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)",
    transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
  },
  raised: {
    boxShadow:
      "0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)",
  },
  hexShadow: {
    filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.2))",
    // Filter creates a stacking context, so we need to ensure this container
    // itself has a high z-index when dragging, otherwise its children's
    // high z-index will be local to this container.
  },
  hexBorderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    fill: "none",
    strokeWidth: 3,
    stroke: (props: Props) => toCssColor(props.color),
  },
  media: {
    width: "70%",
    height: "70%",
    objectFit: "contain",
  },
});

const Character: React.FC<Props> = memo((props) => {
  const classes = useStyles(props);
  const {
    isDragging,
    contents,
    className,
    dragAttributes,
    onDelete,
    pos,
    gridType,
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
      /* istanbul ignore next */
      default:
        throw new UnreachableCaseError(contents);
    }
  };

  const renderIcon = (icon: Icon) => {
    return (
      <img
        className={classes.media}
        src={icon.img}
        alt={`Character: ${icon.desc}`}
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

  const {
    ref: dragRef,
    style: dragStyle,
    ...otherDragAttributes
  } = dragAttributes ?? {};

  return (
    <div
      ref={dragRef}
      onContextMenu={onContextMenu}
      className={clsx(
        classes.characterContainer,
        gridType === GridType.Hex && classes.hexShadow
      )}
      style={{
        position: pos ? "absolute" : "relative",
        top: pos?.y,
        left: pos?.x,
        zIndex: pos?.z,
        ...dragStyle,
      }}
      {...otherDragAttributes}
    >
      <div
        className={clsx(
          classes.paper,
          classes.character,
          gridType === GridType.Square ? classes.square : classes.hex,
          className,
          {
            [classes.raised]: gridType === GridType.Square && isDragging,
          }
        )}
      >
        {renderContents(contents)}
        {gridType === GridType.Hex && (
          <svg
            className={classes.hexBorderOverlay}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M25,0 L75,0 L100,50 L75,100 L25,100 L0,50 Z"
              strokeWidth={11}
            />
          </svg>
        )}
      </div>
    </div>
  );
});

export default Character;
