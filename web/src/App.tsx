import React, { useState } from "react";
import Token from "./Token";
import dwarf from "./dwarf.svg";
import bear from "./bear.svg";
import { List } from "immutable";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@material-ui/lab";
import { makeStyles } from "@material-ui/core";
import AdbIcon from "@material-ui/icons/Adb";
import AccessibleForwardIcon from "@material-ui/icons/AccessibleForward";
import {GRID_SIZE_PX} from "./config";

let BACKGROUND_COLOR = "#F5F5DC";
let GRID_COLOR = "#947C65";

const snapToGrid = (x: number) => Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;

const useStyles = makeStyles(theme => ({
  map: {
    backgroundColor: BACKGROUND_COLOR,
    backgroundImage: `repeating-linear-gradient(
      0deg,
      transparent,
      transparent ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX}px
    ),
    repeating-linear-gradient(
      -90deg,
      transparent,
      transparent ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX}px
    )`,
    backgroundSize: `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px`,
    height: "100%",
    width: "100%",
    position: "absolute"
  },
  speedDial: {
    position: "absolute",
    bottom: theme.spacing(2),
    right: theme.spacing(2)
  }
}));

const App = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState(
    List.of(
      { x: 0, y: 0, icon: bear },
      { x: 50, y: 0, icon: dwarf },
      { x: 100, y: 0, icon: dwarf }
    )
  );

  return (
    <div>
      <div className={classes.map}>
        {tokens.map((token, i) => (
          <Token
            x={token.x}
            y={token.y}
            icon={token.icon}
            key={i}
            onMoved={(x, y) => {
              setTokens(
                tokens.set(i, {
                  x: snapToGrid(x),
                  y: snapToGrid(y),
                  icon: token.icon
                })
              );
            }}
          />
        ))}
      </div>
      <SpeedDial
        className={classes.speedDial}
        ariaLabel="Add token"
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction icon={<AdbIcon />} tooltipTitle="Add bear" />
        <SpeedDialAction
          icon={<AccessibleForwardIcon />}
          tooltipTitle="Add dwarf"
        />
      </SpeedDial>
    </div>
  );
};

export default App;
