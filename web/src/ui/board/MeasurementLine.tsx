import React from "react";
import { makeStyles } from "@material-ui/core";
import Pos2d, { gridDistance } from "../../util/shape-math";
import { GRID_SIZE_PX } from "../../config";

const useStyles = makeStyles((theme) => ({
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 100,
  },
  line: {
    stroke: theme.palette.primary.main,
    strokeWidth: 4,
    filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))",
  },
  endpoint: {
    fill: theme.palette.primary.main,
    filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))",
  },
  text: {
    fill: "#fff",
    fontSize: "14px",
    fontWeight: "bold",
    paintOrder: "stroke",
    stroke: "#000",
    strokeWidth: "3px",
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
  },
}));

interface Props {
  start: Pos2d; // Grid coordinates
  end: Pos2d;   // Grid coordinates
}

const MeasurementLine: React.FC<Props> = ({ start, end }) => {
  const classes = useStyles();

  const startPx = {
    x: (start.x + 0.5) * GRID_SIZE_PX,
    y: (start.y + 0.5) * GRID_SIZE_PX,
  };
  const endPx = {
    x: (end.x + 0.5) * GRID_SIZE_PX,
    y: (end.y + 0.5) * GRID_SIZE_PX,
  };

  const distanceFeet = gridDistance(start, end);

  if (distanceFeet === 0) return null;

  const midPx = {
    x: (startPx.x + endPx.x) / 2,
    y: (startPx.y + endPx.y) / 2,
  };

  return (
    <svg className={classes.svg}>
      <circle
        cx={startPx.x}
        cy={startPx.y}
        r={5}
        className={classes.endpoint}
      />
      <circle cx={endPx.x} cy={endPx.y} r={5} className={classes.endpoint} />
      <line
        x1={startPx.x}
        y1={startPx.y}
        x2={endPx.x}
        y2={endPx.y}
        className={classes.line}
      />
      <text
        x={midPx.x}
        y={midPx.y}
        className={classes.text}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {distanceFeet} ft
      </text>
    </svg>
  );
};

export default MeasurementLine;
