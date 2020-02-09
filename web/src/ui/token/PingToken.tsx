import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import React, { CSSProperties } from "react";

const useStyles = makeStyles({
  ping: {
    boxShadow: `50px solid #999`,
    borderRadius: "50%",
    zIndex: 1000,
    animation: "$pulsate 1s ease-out",
    animationIterationCount: "infinite"
  },
  "@keyframes pulsate": {
    "0%": {
      boxShadow: "0 0 0 0px rgba(0, 0, 0, 0.5)"
    },
    "100%": {
      boxShadow: "0 0 0 35px rgba(0, 0, 0, 0)"
    }
  }
});

interface Props {
  x: number;
  y: number;
}

const PingToken = (props: Props) => {
  const classes = useStyles();
  const style: CSSProperties = {
    position: "absolute",
    left: props.x + GRID_SIZE_PX / 2,
    top: props.y + GRID_SIZE_PX / 2
  };

  return <div style={style} className={classes.ping} />;
};

export default PingToken;
