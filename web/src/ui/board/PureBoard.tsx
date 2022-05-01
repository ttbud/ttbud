import { BoardState } from "./board-state";
import React, { MouseEventHandler } from "react";
import { GRID_SIZE_PX } from "../../config";
import { EntityType } from "../../types";
import Fade from "../transition/Fade";
import Floor from "../token/Floor";
import NoopTransition from "../transition/NoopTransition";
import Draggable from "../drag/Draggable";
import Character from "../token/Character";
import Ping from "../token/Ping";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { TransitionGroup } from "react-transition-group";
import makeStyles from "@mui/styles/makeStyles";
import Pos2d from "../../util/shape-math";
import useBoardInputMonitor from "./useBoardInputMonitor";

let GRID_COLOR = "#947C65";

const preventDefault: MouseEventHandler = (e) => e.preventDefault();

const useStyles = makeStyles((theme) => ({
  container: {
    width: "100%",
    height: "100%",
  },
  board: {
    // Otherwise safari will try to "select" the empty text next to each floor icon
    userSelect: "none",
    backgroundColor: theme.palette.background.default,
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
    borderBottom: `1px solid ${GRID_COLOR}`,
    borderRight: `1px solid ${GRID_COLOR}`,
    backgroundSize: `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px`,
    height: "100%",
    width: "100%",
    zIndex: 0,
  },
}));

interface Props {
  boardState: BoardState;
  onDraw(pos: Pos2d): void;
  onPing(pos: Pos2d): void;
  onDelete(tokenId: string): void;
}

const PureBoard: React.FC<Props> = ({
  boardState,
  onDraw,
  onPing,
  onDelete,
}) => {
  const classes = useStyles();
  const { ref, onPointerDown, onPointerMove, onPointerUp, style } =
    useBoardInputMonitor({
      boardState,
      onDraw,
      onPing,
      onDelete,
    });

  const tokenIcons = Object.values(boardState.entityById).map((token) => {
    const pixelPos = {
      x: token.pos.x * GRID_SIZE_PX,
      y: token.pos.y * GRID_SIZE_PX,
    };

    switch (token.type) {
      case EntityType.Floor:
        return (
          <Fade lengthMs={50} key={token.id}>
            <Floor key={token.id} contents={token.contents} pos={pixelPos} />
          </Fade>
        );
      case EntityType.Character:
        return (
          // Need to have some sort of transition otherwise the element will
          // never be removed from the dom :(
          <NoopTransition key={token.id}>
            <div
              style={{
                position: "absolute",
                top: pixelPos.y,
                left: pixelPos.x,
              }}
            >
              <Draggable
                id={token.id}
                descriptor={{
                  type: "character",
                  contents: token.contents,
                  source: "board",
                }}
              >
                <Character
                  contents={token.contents}
                  color={token.color}
                  pos={{
                    x: pixelPos.x,
                    y: pixelPos.y,
                    z: token.pos.z,
                  }}
                />
              </Draggable>
            </div>
          </NoopTransition>
        );
      case EntityType.Ping:
        return (
          <Fade key={token.id} lengthMs={1000}>
            <Ping x={pixelPos.x} y={pixelPos.y} />
          </Fade>
        );
      /* istanbul ignore next */
      default:
        throw new UnreachableCaseError(token);
    }
  });

  return (
    <div
      ref={ref}
      className={classes.container}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={preventDefault}
      aria-label={"Board"}
      style={style}
    >
      <div className={classes.board}>
        <TransitionGroup>{tokenIcons}</TransitionGroup>
      </div>
    </div>
  );
};

export default PureBoard;
