import React, { forwardRef, memo } from "react";
import { Card, CardMedia, CardProps, makeStyles } from "@material-ui/core";
import { Icon } from "../icons";
import { GRID_SIZE_PX } from "../../config";

const useStyles = makeStyles({
  media: {
    margin: "20%",
    width: "60%",
    height: "60%"
  }
});

export interface Size {
  height: number;
  width: number;
}

interface TokenProps {
  isDragging: boolean;
  icon: Icon;
}

type Props = TokenProps & CardProps;

const Character: React.FC<Props> = memo(
  forwardRef(({ icon, isDragging, ...cardProps }, ref) => {
    const classes = useStyles();

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
          ...cardProps.style
        }}
      >
        <CardMedia
          className={classes.media}
          image={icon.img}
          draggable={false}
        />
      </Card>
    );
  })
);

export default Character;
