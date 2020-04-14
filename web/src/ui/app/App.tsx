import { makeStyles } from "@material-ui/core";
import React, { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { replaceTokens } from "../board/board-slice";
import Board from "../board/Board";
import { ICONS } from "../icons";
import SearchDialog from "../search/SearchDialog";
import Settings from "../settings/Settings";
import CharacterTray from "../tray/CharacterTray";
import FloorTray from "../tray/FloorTray";
import { RootState } from "../../store/rootReducer";
import isMac from "../../util/isMac";
import { startSearching, stopSearching, toggleDebug } from "./app-slice";

const useStyles = makeStyles((theme) => ({
  app: {
    width: 4000,
    height: 2000,
  },
  characterTray: {
    position: "fixed",
    zIndex: 3,
    // Same location whether the scrollbar is visible or not
    // (Scrollbar width = 100vh - 100%)
    bottom: `calc(${theme.spacing(3)}px - (100vh - 100%))`,
    left: theme.spacing(1),
  },
  floorTray: {
    display: "inline-flex",
    position: "fixed",
    zIndex: 2,
    // Same location whether the scrollbar is visible or not
    // (Scrollbar width = 100vh - 100%)
    bottom: `calc(${theme.spacing(3)}px - (100vh - 100%))`,
    left: "calc(50% + (100vw - 100%)/2)",
    transform: "translateX(-50%)",
  },
  settings: {
    position: "fixed",
    bottom: `calc(${theme.spacing(3)}px - (100vh - 100%))`,
    right: `calc(${theme.spacing(3)}px - (100vw - 100%))`,
  },
}));

const searchModifier = isMac() ? "Meta" : "Control";

const App = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const { debugEnabled, searching } = useSelector((state: RootState) => ({
    debugEnabled: state.app.debug,
    searching: state.app.searching,
  }));

  useEffect(() => {
    // Start in the center of the board
    window.scrollTo(
      document.body.scrollWidth / 2 - window.screen.width / 2,
      document.body.scrollHeight / 2 - window.screen.height / 2
    );
  }, []);

  useEffect(() => {
    const onKeyPressed = (e: KeyboardEvent) => {
      if (e.getModifierState(searchModifier) && e.key === "f") {
        dispatch(startSearching());
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyPressed);
    return () => document.removeEventListener("keydown", onKeyPressed);
  }, [dispatch]);

  const onSearchDialogClose = useCallback(() => dispatch(stopSearching()), [
    dispatch,
  ]);

  const onClearMap = () => dispatch(replaceTokens([]));

  const onDebugToggled = useCallback(() => dispatch(toggleDebug()), [dispatch]);

  return (
    <div className={classes.app}>
      <Board />
      <SearchDialog
        open={searching}
        icons={ICONS}
        onClose={onSearchDialogClose}
      />
      <div className={classes.characterTray}>
        <CharacterTray />
      </div>
      <div className={classes.floorTray}>
        <FloorTray />
      </div>
      <Settings
        className={classes.settings}
        onClearMap={onClearMap}
        debugEnabled={debugEnabled}
        onDebugToggled={onDebugToggled}
      />
    </div>
  );
};

export default App;
