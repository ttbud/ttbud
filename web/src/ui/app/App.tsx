import makeStyles from "@mui/styles/makeStyles";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {clear,} from "../board/board-slice";
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
  DndContext,



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
import { assert } from "../../util/invariants";
import useTrayItems from "../tray/useTrayItems";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import { ContentType } from "../../types";
import { invariant } from "fp-ts";
import useDragMonitor from "../drag/useDragMonitor";
import { DragEvent } from "../drag/useDragMonitor";
import SearchDialog from "../search/SearchDialog";
import { ICONS } from "../icons";
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
    left: (props) => (props.searching ? 300 + spacing : spacing),
  },
  searchTray: {
    position: "fixed",
    width: 300,
    height: "100%",
    left: (props) => (props.searching ? 0 : -300),
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

const defaultCharacters = DEFAULT_CHARACTER_ICONS.map((icon) => ({
  id: uuid(),
  contents: { type: ContentType.Icon, iconId: icon.id } as const,
}));

const App: React.FC<Props> = ({ apiClient }) => {
  const dispatch = useDispatch();
  const characterTray = useTrayItems(defaultCharacters);
  const { searching, boardState, activeFloor } = useSelector(
    (state: RootState) => ({
      searching: state.app.searching,
      activeFloor: state.floorTray.activeFloor,
      boardState: state.board.local,
    })
  );
  const classes = useStyles({ searching: searching });

  const [touring, setTouring] = useState(false);
  const board = useBoardActions(activeFloor);

  // const onDrop = useCallback(
  //   ({ descriptor, dragId, src, current }: DragEvent) => {
  //     // If they didn't drop in a valid location, we don't have to do anything
  //     if (!current) return;
  //
  //     switch (current.droppableId) {
  //       case DROPPABLE_IDS.BOARD:
  //         const id = descriptor.tokenId ?? uuid();
  //         board.onDrop(id, dragId, current.rect, descriptor.contents);
  //         break;
  //       case DROPPABLE_IDS.CHARACTER_TRAY:
  //         break;
  //       case DROPPABLE_IDS.FLOOR_TRAY:
  //         break;
  //     }
  //
  //     if (src.droppableId !== current.droppableId) {
  //       switch (src.droppableId) {
  //         case DROPPABLE_IDS.CHARACTER_TRAY:
  //           assert(
  //             src.sortableIdx !== undefined,
  //             "No sortable index set for drag from character tray"
  //           );
  //           characterTray.renewItemId(src.sortableIdx);
  //           break;
  //         case DROPPABLE_IDS.BOARD:
  //           assert(descriptor.tokenId, "No token id set for drag from board");
  //           board.onDragOff(descriptor.tokenId);
  //           break;
  //         case DROPPABLE_IDS.FLOOR_TRAY:
  //           //TODO:
  //           break;
  //       }
  //     }
  //   },
  //   []
  // );

  const onOver = useCallback(() => {}, []);
  const onDrop = useCallback(() => {}, []);

  const { activeItem, ...dragCallbacks } = useDragMonitor({ onDrop, onOver });

  // const onDragEnd = useCallback(
  //   (event: DragEndEvent) => {
  //     const descriptor = event.active.data.current as DragDescriptor;
  //     const overId = event.over?.id;
  //     const srcContainerId = descriptor.sortable?.containerId;
  //     const destContainerId = event.over?.data.current?.sortable?.containerId;
  //
  //     if (overId === DROPPABLE_IDS.BOARD) {
  //       const rect: ClientRect | undefined = (event.collisions?.[0] as any)
  //         ?.dropLocation;
  //       //TODO: Better error message
  //       assert(rect, "Event missing drop location");
  //
  //       const id = descriptor.tokenId ?? uuid();
  //       board.onDrop(
  //         id,
  //         event.active.id,
  //         rect,
  //         event.active.data.current!.contents
  //       );
  //
  //       if (descriptor.sortable?.containerId === DROPPABLE_IDS.CHARACTER_TRAY) {
  //         characterTray.renewItemId(descriptor.sortable.index);
  //       }
  //     } else if (destContainerId === DROPPABLE_IDS.CHARACTER_TRAY) {
  //       const destIdx = event.over?.data.current?.sortable?.index;
  //       if (srcContainerId === DROPPABLE_IDS.CHARACTER_TRAY) {
  //         characterTray.moveItem(descriptor.sortable!.index, destIdx);
  //       } else {
  //         characterTray.addItem({
  //           idx: destIdx,
  //           src: destContainerId,
  //           bp: { ...descriptor, id: descriptor.tokenId ?? uuid() },
  //         });
  //       }
  //     }
  //   },
  //   [board, characterTray]
  // );

  // const onDragOver = useCallback(
  //   ({ active, over }: DragOverEvent) => {
  //     const overId = over?.id;
  //     if (!overId) {
  //       lastOverContainerIdRef.current = undefined;
  //       return;
  //     }
  //
  //     const descriptor = active.data.current as DragDescriptor;
  //     const src = descriptor.source;
  //     const overContainer = over?.data.current?.sortable?.containerId ?? overId;
  //     const lastOverContainer = lastOverContainerIdRef.current;
  //     lastOverContainerIdRef.current = overContainer;
  //
  //     if (!overContainer || overContainer === lastOverContainer) return;
  //
  //     if (
  //       overContainer === DROPPABLE_IDS.CHARACTER_TRAY &&
  //       src !== DROPPABLE_IDS.CHARACTER_TRAY
  //     ) {
  //       const overIndex = characterTray.items.findIndex(
  //         (item) => item.id === overId
  //       );
  //
  //       assert(active.rect.current.translated, "No active translated rect?");
  //       assert(active.data.current?.contents, "No draggable contents");
  //       const activeCenter = centerOf(active.rect.current.translated);
  //       const overCenter = centerOf(over.rect);
  //
  //       const newIndex = activeCenter > overCenter ? overIndex + 1 : overIndex;
  //       characterTray.addItem({
  //         idx: newIndex,
  //         src,
  //         bp: { id: active.id, contents: active.data.current.contents },
  //       });
  //       if (src == DROPPABLE_IDS.BOARD) {
  //         assert(descriptor.tokenId, "Board token missing token id");
  //         board.onDragOff(descriptor.tokenId);
  //       }
  //     } else if (
  //       lastOverContainer === DROPPABLE_IDS.CHARACTER_TRAY &&
  //       src !== DROPPABLE_IDS.CHARACTER_TRAY
  //     ) {
  //       console.log("removing character");
  //       const idx = characterTray.items.findIndex(
  //         (item) => item.id === active.id
  //       );
  //       characterTray.removeItem(idx);
  //       if (src === DROPPABLE_IDS.BOARD) {
  //         assert(descriptor.tokenId, "Board token missing token id");
  //         board.onDragReturn(descriptor.tokenId, active.id);
  //       }
  //     }
  //   },
  //   [characterTray]
  // );

  const onRemoveCharacterBlueprint = useCallback(
    (id: string) => {
      characterTray.removeItem(
        characterTray.items.findIndex((item) => item.id === id)
      );
    },
    [characterTray]
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
        if (searching) {
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
      {...dragCallbacks}
      autoScroll={false}
      modifiers={modifiers}
      collisionDetection={ttbudCollisionDetector}
    >
      {/*<MobileWarningDialog />*/}
      <Tour isOpen={touring} onCloseClicked={() => setTouring(false)} />
      <div className={classes.app}>
        <PureBoard boardState={boardState} {...board} />
        <div className={classes.searchTray}>
          <SearchDialog
            open={searching}
            icons={ICONS}
            onClose={onSearchDialogClose}
          />
        </div>
        <div className={classes.characterTray}>
          <PureCharacterTray
            items={characterTray.items}
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
