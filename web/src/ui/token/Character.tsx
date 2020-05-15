import React, { forwardRef, memo } from "react";
import { Card, CardMedia, CardProps, makeStyles } from "@material-ui/core";
import { Icon } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import {Color} from "../../network/BoardStateApiClient";

const useStyles = makeStyles({
  media: {
    margin: "20%",
    width: "60%",
    height: "60%",
  },
});

export interface Size {
  height: number;
  width: number;
}

interface CharacterProps {
  isDragging: boolean;
  icon: Icon;
  characterColor?: Color;
}

type Props = CharacterProps & CardProps;

const Character: React.FC<Props> = memo(
  forwardRef(({ icon, isDragging, characterColor, ...cardProps }, ref) => {
    const classes = useStyles();

    const borderStyles = characterColor ? {border: `4px solid rgb(${characterColor.red}, ${characterColor.green}, ${characterColor.blue})`} : {};
    return (
      <Card
        {...cardProps}
        ref={ref}
        raised={isDragging}
        style={{
          width: GRID_SIZE_PX,
          height: GRID_SIZE_PX,
          zIndex: isDragging ? 1000 : "auto",
          position: isDragging ? "relative" : "static",
          ...borderStyles,
          ...cardProps.style,
        }}
      >
        <CardMedia
          className={classes.media}
          image={icon.img}
          aria-label={`Character: ${icon.desc}`}
          draggable={false}
        />
      </Card>
    );
  })
);

export default Character;
