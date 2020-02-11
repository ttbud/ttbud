import React, { useCallback, useEffect } from "react";
import Board from "../board/Board";
import CharacterTray from "../tray/CharacterTray";
import { makeStyles } from "@material-ui/core";
import SearchDialog from "../search/SearchDialog";
import { Icon, ICONS } from "../icons";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { startSearching, stopSearching } from "../../state/app-slice";
import FloorTray from "../tray/FloorTray";
import { DragStateType } from "../../drag/DragStateTypes";
import { addFloor, addPing, removeToken } from "../../state/board-slice";
import uuid from "uuid";
import { setActiveFloor } from "../../state/floor-tray-slice";
import { RootState } from "../../state/rootReducer";
import Pos2d from "../../util/shape-math";
import { removeIcon } from "../../state/character-tray-slice";

const useStyles = makeStyles(theme => ({
  app: {
    width: "100vw",
    height: "100vh"
  },
  characterTray: {
    position: "fixed",
    zIndex: 2,
    bottom: theme.spacing(1),
    left: theme.spacing(1)
  },
  floorTray: {
    display: "inline-flex",
    position: "fixed",
    bottom: theme.spacing(1),
    left: "50%",
    transform: "translateX(-50%)"
  }
}));

const App = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const {
    isDragging,
    tokens,
    pings,
    activeFloor,
    searching,
    floorTrayIcons,
    characterTrayIcons
  } = useSelector(
    (state: RootState) => ({
      isDragging: state.drag.type === DragStateType.DRAGGING,
      tokens: state.board.tokens,
      pings: state.board.pings,
      activeFloor: state.floorTray.activeFloor,
      searching: state.app.searching,
      floorTrayIcons: state.floorTray.icons,
      characterTrayIcons: state.characterTray.icons
    }),
    shallowEqual
  );

  useEffect(() => {
    const onKeyPressed = (e: KeyboardEvent) => {
      if (e.getModifierState("Control") && e.key === "f") {
        dispatch(startSearching());
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyPressed);
    return () => document.removeEventListener("keydown", onKeyPressed);
  }, [dispatch]);

  const onFloorSelected = useCallback(
    (icon: Icon) => dispatch(setActiveFloor(icon)),
    [dispatch]
  );

  const onSearchDialogClose = useCallback(() => dispatch(stopSearching()), [
    dispatch
  ]);

  const onFloorCreated = (iconId: string, pos: Pos2d) =>
    dispatch(addFloor({ pos, iconId }));

  const onPingCreated = (pos: Pos2d) => {
    return dispatch(
      addPing({
        id: uuid(),
        x: pos.x,
        y: pos.y
      })
    );
  };

  const onTokenDeleted = (id: string) => dispatch(removeToken({ id }));
  const onTrayIconRemoved = useCallback(
    (icon: Icon) => dispatch(removeIcon(icon)),
    [dispatch]
  );

  return (
    <div className={classes.app}>
      <Board
        activeFloor={activeFloor}
        isDragging={isDragging}
        tokens={tokens}
        pings={pings}
        onFloorCreated={onFloorCreated}
        onPingCreated={onPingCreated}
        onTokenDeleted={onTokenDeleted}
      />
      <SearchDialog
        open={searching}
        icons={ICONS}
        onClose={onSearchDialogClose}
      />
      <div className={classes.characterTray}>
        <CharacterTray
          icons={characterTrayIcons}
          onIconRemoved={onTrayIconRemoved}
        />
      </div>
      <div className={classes.floorTray}>
        <FloorTray
          icons={floorTrayIcons}
          activeFloor={activeFloor}
          onFloorSelected={onFloorSelected}
        />
      </div>
    </div>
  );
};

export default App;
