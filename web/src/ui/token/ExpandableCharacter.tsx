import React, { useEffect, useState } from "react";
import { makeStyles, Theme } from "@material-ui/core/styles";
import PaletteIcon from "@material-ui/icons/Palette";
import Card from "@material-ui/core/Card";
import ResizeIcon from "@material-ui/icons/Crop";
import CardActions from "@material-ui/core/CardActions";
import IconButton from "@material-ui/core/IconButton";
import { ICONS_BY_ID } from "../icons";
import { ContentType, TokenContents } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { CardMedia, Divider, Fade } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import { assert } from "../../util/invariants";
import Draggable, { DragAttributes } from "../../drag/Draggable";
import { DraggableType } from "../../drag/DragStateTypes";

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  root: ({expanded}) => ({
    width: expanded ? GRID_SIZE_PX + 84 : GRID_SIZE_PX,
    overflow: "none",
    height: GRID_SIZE_PX,
    boxSizing: "border-box",
    border: `3px solid rgb(255, 0, 0)`,
    transition: theme.transitions.create("width", {
      duration: theme.transitions.duration.short,
    }),
  }),
  dragTarget: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: GRID_SIZE_PX - 6,
    height: GRID_SIZE_PX - 6,
  },
  media: {
    height: "80%",
    width: "80%",
  },
  divider: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  actions: ({ expanded }) => ({
    //TODO: This doesn't work because we also have to check if we're dragging
    width: expanded ? 84 : 0,
  }),
}));

interface StyleProps {
  expanded: boolean;
}

export interface Props {
  contents: TokenContents;
}

const HOVER_EXPAND_DELAY_MS = 350;

const ExpandableCharacter: React.FC<Props> = ({ contents }) => {
  const [hoverDelayExpired, setHoverDelayExpired] = useState(false);
  const [hovering, setHovering] = useState(false);

  const classes = useStyles({ expanded: hoverDelayExpired });

  useEffect(() => {
    if (hovering) {
      const timeoutId = setTimeout(
        () => setHoverDelayExpired(true),
        HOVER_EXPAND_DELAY_MS
      );
      return () => clearTimeout(timeoutId);
    } else {
      setHoverDelayExpired(false);
    }
  }, [hovering]);

  const renderContents = (
    contents: TokenContents,
    dragAttributes: Pick<DragAttributes, "onPointerDown" | "style">
  ) => {
    switch (contents.type) {
      case ContentType.Icon:
        return renderIcon(contents.iconId, dragAttributes);
      case ContentType.Text:
        return contents.text.toLocaleUpperCase();
      default:
        throw new UnreachableCaseError(contents);
    }
  };

  const renderIcon = (
    iconId: string,
    dragAttributes: Pick<DragAttributes, "onPointerDown" | "style">
  ) => {
    const icon = ICONS_BY_ID.get(iconId);
    assert(icon, `Invalid icon id ${iconId}`);

    return (
      <div className={classes.dragTarget} {...dragAttributes}>
        <CardMedia
          className={classes.media}
          image={icon.img}
          aria-label={`Character: ${icon.desc}`}
          draggable={false}
        />
      </div>
    );
  };

  return (
    <Draggable
      descriptor={{
        type: DraggableType.TokenBlueprint,
        contents: { type: ContentType.Text, text: "LP" },
        id: "test",
      }}
    >
      {(isDragging, attributes) => {
        const {
          ref,
          onPointerDown,
          onTransitionEnd,
          style: {
            userSelect,
            cursor,
            position,
            transform,
            transition,
            zIndex,
          },
        } = attributes;

        return (
          <Card
            className={classes.root}
            raised={isDragging}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
            onTransitionEnd={onTransitionEnd}
            ref={ref}
            style={{
              userSelect,
              position,
              transform,
              transition,
              zIndex,
            }}
          >
            {renderContents(contents, { onPointerDown, style: { cursor } })}
            <Fade in={hoverDelayExpired && !isDragging}>
              <Divider
                className={classes.divider}
                orientation={"vertical"}
                flexItem
              />
            </Fade>
            <div
              className={classes.actions}
              style={{ width: !isDragging && hoverDelayExpired ? 84 : 0 }}
            >
              <CardActions>
                <IconButton aria-label="choose character color" size={"small"}>
                  <PaletteIcon />
                </IconButton>
                <IconButton aria-label="share" size={"small"}>
                  <ResizeIcon />
                </IconButton>
              </CardActions>
            </div>
          </Card>
        );
      }}
    </Draggable>
  );
};

export default ExpandableCharacter;
