import makeStyles from "@mui/styles/makeStyles";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addPing,
  clear,
  FLOOR_HEIGHT,
  removeEntity,
  upsertToken,
} from "../board/board-slice";
import Settings from "../settings/Settings";
import CharacterTray from "../tray/CharacterTray";
import FloorTray from "../tray/FloorTray";
import { RootState } from "../../store/rootReducer";
import isMac from "../../util/isMac";
import { startSearching, stopSearching } from "./app-slice";
import { v4 as uuid } from "uuid";
import BoardStateApiClient from "../../network/BoardStateApiClient";
import Tour from "../tour/Tour";
import MobileWarningDialog from "../mobile-warning/MobileWarningDialog";
import {
  ClientRect,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import TokenDragOverlay from "../drag/TokenDragOverlay";
import { DragDescriptor } from "../drag/types";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { containFloorsModifier } from "../tray/containFloorsModifier";
import ttbudCollisionDetector from "../drag/ttbudCollisionDetector";
import Pos2d, { centerOf } from "../../util/shape-math";
import PureBoard from "../board/PureBoard";
import { useBoardActions } from "../board/useBoardActions";
import { DROPPABLE_IDS } from "../DroppableIds";
import { toGridPos } from "../board/useBoardInputMonitor";
import PureCharacterTray from "../tray/PureCharacterTray";
import {
  addCharacter,
  removeCharacter,
  renewCharacter,
} from "../tray/character-tray-slice";
import { assert } from "../../util/invariants";
import SearchDialog from "../search/SearchDialog"
import { ICONS } from "../icons"
import { Theme } from "@mui/material";

interface StyleProps {
  searching: boolean;
}

const spacing = 8;

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  app: {
    width: 4000,
    height: 2000,
    // Otherwise safari will try to select the connection notifier text even when you're long pressing no where near it
    userSelect: "none",
  },
  characterTray: {
    position: "fixed",
    bottom: theme.spacing(3),
    left: (props) => props.searching ? 300 + spacing : spacing,
  },
  searchTray: {
    position: "fixed",
    width: 300,
    height: "100%",
    left: (props) => props.searching ? 0 : -300,
    top: 0,
  },
  floorTray: {
    position: "fixed",
    bottom: 0,
    left: 0,
    margin: "0 8px 8px 0",
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },
  connectionNotifier: {
    position: "fixed",
    top: spacing,
    left: "50%",
    transform: "translateX(-50%)",
  },
  settings: {
    position: "fixed",
    bottom: spacing * 3,
    right: spacing * 3,
  },
}));

const searchModifier = isMac() ? "Meta" : "Control";

interface Props {
  apiClient: BoardStateApiClient;
}

const modifiers = [restrictToWindowEdges, containFloorsModifier];

const App: React.FC<Props> = ({ apiClient }) => {
  const dispatch = useDispatch();
  const { searching, boardState, activeFloor, characterBlueprints } =
    useSelector((state: RootState) => ({
      searching: state.app.searching,
      activeFloor: state.floorTray.activeFloor,
      boardState: state.board.local,
      characterBlueprints: state.characterTray.characterBlueprints,
    }));
  const classes = useStyles({searching: searching});

  const [touring, setTouring] = useState(false);
  const [activeItem, setActiveItem] = useState<DragDescriptor>();
  const boardActions = useBoardActions(activeFloor);
  const lastOverContainerIdRef = useRef<string>();

  const onDragStart = useCallback((event: DragStartEvent) => {
    const contents = event.active.data.current as DragDescriptor;
    setActiveItem(contents);
    lastOverContainerIdRef.current = contents.source;
  }, []);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(undefined);
    const descriptor = event.active.data.current as DragDescriptor;
    const src = descriptor.source;
    const rect: ClientRect | undefined = (event.collisions?.[0] as any)
      ?.dropLocation;

    if (!rect) return;

    // Ignore anything but board for now
    if (event.over?.id !== DROPPABLE_IDS.BOARD) return;
    boardActions.onDrop(
      event.active.id,
      rect,
      event.active.data.current!.contents
    );

    if (
      event.active.data.current?.sortable?.containerId ===
      DROPPABLE_IDS.CHARACTER_TRAY
    ) {
      const idx = event.active.data.current.sortable.index;
      dispatch(renewCharacter(idx));
    }
  }, [dispatch, boardActions]);

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    const overId = over?.id;
    if (!overId) {
      lastOverContainerIdRef.current = undefined;
      return;
    }

    const descriptor = active.data.current as DragDescriptor;
    const src = descriptor.source;
    const overContainer = over?.data.current?.sortable?.containerId ?? overId;
    const lastOverContainer = lastOverContainerIdRef.current;
    lastOverContainerIdRef.current = overContainer;

    if (!overContainer || overContainer === lastOverContainer) return;

    console.log({ lastOverContainer, src });
    if (
      overContainer === DROPPABLE_IDS.CHARACTER_TRAY &&
      src !== DROPPABLE_IDS.CHARACTER_TRAY
    ) {
      const overIndex = characterBlueprints.findIndex((bp) => bp.id === overId);

      assert(active.rect.current.translated, "No active translated rect?");
      assert(active.data.current?.contents, "No draggable contents");
      const activeCenter = centerOf(active.rect.current.translated);
      const overCenter = centerOf(over.rect);

      const newIndex = activeCenter > overCenter ? overIndex + 1 : overIndex;
      dispatch(
        addCharacter({
          idx: newIndex,
          blueprint: {
            id: active.id,
            contents: active.data.current.contents,
          },
        })
      );
    } else if (
      lastOverContainer === DROPPABLE_IDS.CHARACTER_TRAY &&
      src !== DROPPABLE_IDS.CHARACTER_TRAY
    ) {
      const idx = characterBlueprints.findIndex((bp) => bp.id === active.id);
      dispatch(removeCharacter(idx));
    }
  }, [dispatch, characterBlueprints]);

  const onRemoveCharacterBlueprint = useCallback(
    (id: string) => {
      dispatch(
        removeCharacter(characterBlueprints.findIndex((bp) => bp.id === id))
      );
    },
    [dispatch, characterBlueprints]
  );

  useEffect(() => {
    const path = window.location.pathname.split("/room/")[1];
    const roomId = path ? window.atob(path) : uuid();
    window.history.replaceState(
      {},
      "Your special room",
      `/room/${window.btoa(roomId)}`
    );

    apiClient.connect(roomId);
  }, [apiClient]);

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
        if(searching) {
          dispatch(stopSearching());
        } else {
          dispatch(startSearching());
        }
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyPressed);
    return () => document.removeEventListener("keydown", onKeyPressed);
  }, [dispatch, searching]);

  const onSearchDialogClose = useCallback(
    () => dispatch(stopSearching()),
    [dispatch]
  );

  const onClearMap = () => dispatch(clear());

  const reconnect = () => apiClient.reconnect();

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragMove={onDragOver}
      autoScroll={false}
      modifiers={modifiers}
      collisionDetection={ttbudCollisionDetector}
    >
      {/*<MobileWarningDialog />*/}
      <Tour isOpen={touring} onCloseClicked={() => setTouring(false)} />
      <div className={classes.app}>
        <PureBoard boardState={boardState} {...boardActions} />
        <div className={classes.searchTray}>
          <SearchDialog
            open={searching}
            icons={ICONS}
            onClose={onSearchDialogClose}
          />
        </div>
        <div className={classes.characterTray}>
          <PureCharacterTray
            blueprints={characterBlueprints}
            onRemoveBlueprint={onRemoveCharacterBlueprint}
          />
        </div>
        <div className={classes.floorTray}>
          <FloorTray />
        </div>
        <Settings
          className={classes.settings}
          onClearMap={onClearMap}
          onTourClicked={() => setTouring(true)}
        />
        {/*<div className={classes.connectionNotifier}>*/}
        {/*  <ConnectionNotifier onReconnectClick={reconnect} />*/}
        {/*</div>*/}
      </div>
      <TokenDragOverlay activeItem={activeItem} />
    </DndContext>
  );
};

export default App;
