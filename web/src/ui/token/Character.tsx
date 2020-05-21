import React, { forwardRef, memo } from "react";
import { Card, CardMedia, CardProps, makeStyles } from "@material-ui/core";
import { ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { ContentType, TokenContents } from "../../types";
import { assert } from "../../util/invariants";
import { Color } from "../../types";

const useStyles = makeStyles({
  media: {
    width: "70%",
    height: "70%",
  },
});

export interface Size {
  height: number;
  width: number;
}

interface CharacterProps {
  isDragging: boolean;
  contents: TokenContents;
  characterColor?: Color;
}

type Props = CharacterProps & CardProps;

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const Character: React.FC<Props> = memo(
  forwardRef(({ contents, isDragging, characterColor, ...cardProps }, ref) => {
    const classes = useStyles();

    const renderIcon = (iconId: string) => {
      const icon = ICONS_BY_ID.get(iconId);
      assert(icon, `Invalid icon id ${iconId}`);

      return (
        <CardMedia
          className={classes.media}
          image={icon.img}
          aria-label={`Character: ${icon.desc}`}
          draggable={false}
        />
      );
    };

    return (
      <Card
        {...cardProps}
        ref={ref}
        raised={isDragging}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: GRID_SIZE_PX,
          height: GRID_SIZE_PX,
          zIndex: isDragging ? 1000 : "auto",
          position: isDragging ? "relative" : "static",
          border: `3px solid ${toCssColor(characterColor)}`,
          ...cardProps.style,
        }}
      >
        {contents.type === ContentType.Text
          ? contents.text.toLocaleUpperCase()
          : renderIcon(contents.iconId)}
      </Card>
    );
  })
);

export default Character;
