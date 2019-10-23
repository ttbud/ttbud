import React, { useState } from "react";
import Token from "./Token";
import dwarf from "./dwarf.svg";
import bear from "./bear.svg";
import { List } from "immutable";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "./config";
import TokenSheet from "./TokenSheet";

let BACKGROUND_COLOR = "#F5F5DC";
let GRID_COLOR = "#947C65";

const snapToGrid = (x: number) => Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;

const useStyles = makeStyles({
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
    position: "absolute",
    // All the tokens inside the map have to be position absolute so that the
    // drag offset calculations work properly
    "& div": {
      position: "absolute"
    }
  }
});

const TOKEN_TYPES = [
  { id: "a511ebd2-827b-490d-b20a-c206e4edd25e", icon: bear },
  { id: "643c7cf8-befb-4a72-b707-9c0399d2a365", icon: dwarf }
];

const App = () => {
  const classes = useStyles();
  const [tokens, setTokens] = useState(
    List.of(
      { x: 0, y: 0, icon: bear },
      { x: 50, y: 50, icon: dwarf },
      { x: 100, y: 100, icon: dwarf }
    )
  );

  return (
    <div>
      <div className={classes.map}>
        {tokens.map((token, i) => (
          <Token
            pos={{ x: token.x, y: token.y }}
            icon={token.icon}
            key={i}
            onDropped={(x, y) => {
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
      <TokenSheet
        tokenTypes={TOKEN_TYPES}
        onTokenPlaced={(type, x, y) => {
          setTokens(
            tokens.push({
              x: snapToGrid(x),
              y: snapToGrid(y),
              icon: type.icon
            })
          );
        }}
      />
    </div>
  );
};

export default App;
