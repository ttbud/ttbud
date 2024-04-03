import React, { useCallback, useState } from "react";
import {
  Character,
  ContentType,
  EntityType,
  TokenContents,
  contentId,
} from "../../types";
import { ICONS, WALL_ICON } from "../icons";
import CharacterTray2, { Blueprint } from "../tray/CharacterTray2";
import noop from "../../util/noop";
import { assert } from "../../util/invariants";
import { ListLocation, LocationType } from "../../drag/DragStateTypes";
import restrictToFloorTray from "../tray/floorTrayDragsModifier";
import FloorTray2 from "../tray/FloorTray2";
import Board2 from "../board/Board2";
import { BoardState } from "../board/board-state";
import ReactDOM from "react-dom";
import ttbudCollisionDetector from "../tray/TtbudCollisionDetector";
import Droppable2 from "../../drag/Droppable2";
import { TokenDescriptor } from "../../drag/Draggable2";
import DragOverlay from "../../drag/DragOverlay";
import DndContext2, {
  DragEndEvent,
  DragOverChangedEvent,
  DragStartEvent,
} from "../../drag/DndContext2";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/rootReducer";
import {
  CHARACTER_HEIGHT,
  addFloor,
  upsertCharacter,
} from "../board/board-slice";
import { v4 as uuid } from "uuid";
import { toGridPos } from "../board/grid";
import { centerOf } from "../../util/shape-math";

const WALL_CONTENTS = { type: ContentType.Icon, iconId: WALL_ICON.id } as const;

function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, "0");
}

function randSuffix() {
  const arr = new Uint8Array(5 / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}

const defaultChars: Blueprint[] = ICONS.slice(0, 5).map((icon, i) =>
  makeToken({ type: ContentType.Icon, iconId: icon.id })
);

const defaultFloors: Blueprint[] = ICONS.slice(5, 10).map((icon, i) => ({
  id: `${icon.id}-${randSuffix()}`,
  contents: { iconId: icon.id, type: ContentType.Icon },
}));

const defaultActiveFloor = defaultFloors[0];

function makeToken(content: TokenContents): Blueprint {
  return {
    id: `${contentId(content)}-${randSuffix()}`,
    contents: content,
  };
}

function withItem<T>(arr: Array<T>, item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index, arr.length)];
}

function withoutItem<T>(arr: Array<T>, index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1, arr.length)];
}

function withReplacedItem<T>(arr: Array<T>, item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index + 1, arr.length)];
}

const App2: React.FC = () => {
  //TODO: Add TempBoardToken
  // TempBoardToken {realId: string | undefined, dragId: string}
  // Dragged in from outside
  // TempBoardToken = {realId: undefined, dragId: active draggable id}

  // Dragged out
  // -> TempBoardToken = {realId: networkId, dragId: TEMP}

  // Dragged back in
  // -> TempBoardToken = undefined

  // Drag Ended
  // -> TempBoardToken === undefined
  //    -> Move token in boardState w/ active draggableId to drop location
  // -> TempBoardToken = {realId: networkId, dragId: TEMP}
  //    -> Set dragId for token w/ id = realID to new valid drag id
  // -> TempBoardToken = {realId: undefined, dragId: active draggable id}
  //    -> Add character to board w/ active draggable id and new realId

  const [activeDragDescriptor, setActiveDragDescriptor] =
    useState<TokenDescriptor>();

  const [characterTrayBlueprints, setCharacterTrayBlueprints] =
    useState<Blueprint[]>(defaultChars);

  const [floorTrayBlueprints, setFloorTrayBlueprints] =
    useState<Blueprint[]>(defaultFloors);

  const [activeFloor, setActiveFloor] = useState<Blueprint>(defaultFloors[0]);

  const boardState = useSelector<RootState, BoardState>(
    (state) => state.board.local
  );
  const dispatch = useDispatch();

  //TODO: Explain why this exists
  const [tempBoardCharacter, setTempBoardCharacter] = useState<Character>();

  const onDragContainerChanged = useCallback(
    ({
      draggableId,
      descriptor,
      currentOverId,
      lastContainerId,
      currentContainerId,
      originalDescriptor: origin,
    }: DragOverChangedEvent) => {
      let newCharacterTrayBlueprints = characterTrayBlueprints;
      let newFloorTrayBlueprints = floorTrayBlueprints;

      if (currentContainerId === "board") {
        if (origin.containerId === "board") {
          assert(
            origin.location.type === LocationType.Grid,
            "Origin is board but location type is not grid"
          );
          const tokenId = descriptor.networkId;
          assert(tokenId, "Draggable from the board doesn't have network ID?");
          const character = boardState.entityById[tokenId];
          assert(
            character.type === EntityType.Character,
            "Dragging non-character?"
          );
          setTempBoardCharacter({ ...character, dragId: draggableId });
        } else {
          setTempBoardCharacter({
            contents: descriptor.contents,
            dragId: draggableId,
            id: uuid(),
            pos: { x: -1, y: -1, z: CHARACTER_HEIGHT },
            type: EntityType.Character,
          });
        }
      }

      if (lastContainerId === "board") {
        if (origin.containerId === "board") {
          assert(
            origin.location.type === LocationType.Grid,
            "Origin is board but location type is not grid"
          );
          const tokenId = descriptor.networkId;
          assert(
            tokenId,
            "Could not find token in board that is being dragged"
          );
          const character = boardState.entityById[tokenId];
          assert(
            character.type === EntityType.Character,
            "Dragging non-character?"
          );
          setTempBoardCharacter({ ...character, dragId: uuid() });
        } else {
          setTempBoardCharacter(undefined);
        }
      }

      if (currentContainerId === "floor-tray") {
        const overIdx = newFloorTrayBlueprints.findIndex(
          (token) => token.id === currentOverId
        );

        assert(
          origin.containerId !== "floor-tray",
          "But you can't drag out of the floor tray??"
        );

        newFloorTrayBlueprints = withItem(
          newFloorTrayBlueprints,
          { id: draggableId, contents: descriptor.contents },
          overIdx
        );
      }

      if (lastContainerId === "floor-tray") {
        const currentIdx = floorTrayBlueprints.findIndex(
          (token) => token.id === draggableId
        );

        assert(
          origin.containerId !== "floor-tray",
          "But you can't drag out of the floor tray??"
        );
        // remove the token w/ the current draggable id, because it was temporary to show drag moviness
        newFloorTrayBlueprints = withoutItem(
          newFloorTrayBlueprints,
          currentIdx
        );
      }

      if (currentContainerId === "character-tray") {
        let overIdx = newCharacterTrayBlueprints.findIndex(
          (token) => token.id === currentOverId
        );

        assert(
          origin.containerId === "character-tray" || overIdx !== -1,
          "Not over anything, in the character tray, but didn't start in character tray"
        );

        if (origin.containerId === "character-tray") {
          assert(
            origin.location.type === LocationType.List,
            "It's in character tray but not a list?"
          );
          //overIdx = overIdx === -1 ? origin.location.idx : overIdx;
          // Setting the overIdx to the origin idx means the dragged token
          // will maintain its position even when leaving the tray from
          // a different position. Looks weird but behaves well
          overIdx = origin.location.idx;
          newCharacterTrayBlueprints = withoutItem(
            newCharacterTrayBlueprints,
            origin.location.idx
          );
        }
        newCharacterTrayBlueprints = withItem(
          newCharacterTrayBlueprints,
          {
            id: draggableId,
            contents: descriptor.contents,
          },
          overIdx
        );
      }

      if (lastContainerId === "character-tray") {
        const currentIdx = characterTrayBlueprints.findIndex(
          (token) => token.id === draggableId
        );
        if (origin.containerId === "character-tray") {
          // Create a temporary token to hold the place of the token we're moving into the board
          newCharacterTrayBlueprints = withReplacedItem(
            newCharacterTrayBlueprints,
            makeToken(descriptor.contents),
            currentIdx
          );
        } else {
          // remove the token w/ the current draggable id, because it was temporary to show drag moviness
          newCharacterTrayBlueprints = withoutItem(
            newCharacterTrayBlueprints,
            currentIdx
          );
        }
      }

      ReactDOM.unstable_batchedUpdates(() => {
        setCharacterTrayBlueprints(newCharacterTrayBlueprints);
        setFloorTrayBlueprints(newFloorTrayBlueprints);
      });
    },
    [boardState, characterTrayBlueprints, floorTrayBlueprints]
  );

  const onDragStart = ({ draggableId, descriptor }: DragStartEvent) => {
    console.log("onDragStart", { draggableId, descriptor });
    setActiveDragDescriptor(descriptor);
  };

  const onDragEnd = ({
    draggableId,
    descriptor,
    targetId,
    targetContainerId,
    origin,
    bounds,
  }: DragEndEvent) => {
    console.log("onDragEnd", {
      draggableId,
      descriptor,
      targetId,
      targetContainerId,
    });
    // Also handle drags onto board?

    // Drag Ended
    // -> TempBoardToken === undefined
    //    -> Move token in boardState w/ active draggableId to drop location
    // -> TempBoardToken = {realId: networkId, dragId: TEMP}
    //    -> Set dragId for token w/ id = realID to new valid drag id
    // -> TempBoardToken = {realId: undefined, dragId: active draggable id}
    //    -> Add character to board w/ active draggable id and new realId
    if (targetContainerId === "board") {
      assert(bounds !== null, "Bounds are null??");
      const gridPos = toGridPos(centerOf(bounds));

      if (origin.containerId === "board") {
        assert(
          origin.location.type === LocationType.Grid,
          "Started in board but isn't grid location"
        );
        assert(
          descriptor.networkId,
          "Draggable from board doesn't have network ID?"
        );
        const existingChar = boardState.entityById[descriptor.networkId];

        assert(
          existingChar.type === EntityType.Character,
          "Dragged a non-character?"
        );

        dispatch(
          upsertCharacter({
            character: {
              ...existingChar,
              pos: { ...gridPos, z: CHARACTER_HEIGHT },
            },
          })
        );
      } else {
        dispatch(
          upsertCharacter({
            character: {
              id: uuid(),
              dragId: draggableId,
              contents: descriptor.contents,
              pos: { ...gridPos, z: CHARACTER_HEIGHT },
              type: EntityType.Character,
            },
          })
        );
      }
    }

    let newCharacterTrayTokens = characterTrayBlueprints;
    if (targetContainerId === "character-tray") {
      const overIdx = characterTrayBlueprints.findIndex(
        (token) => token.id === targetId
      );
      const atIdx = characterTrayBlueprints.findIndex(
        (token) => token.id === draggableId
      );

      assert(
        overIdx !== -1 || origin.location.type === LocationType.List,
        "Not over character-tray, but also origin is not character tray (or at least isn't the list location type)"
      );
      const destIdx =
        overIdx === -1 ? (origin.location as ListLocation).idx : overIdx;
      console.log({ overIdx, atIdx, destIdx });

      if (atIdx !== -1) {
        newCharacterTrayTokens = withoutItem(newCharacterTrayTokens, atIdx);
      }
      newCharacterTrayTokens = withItem(
        newCharacterTrayTokens,
        {
          id: draggableId,
          contents: descriptor.contents,
        },
        destIdx
      );
    }
    setCharacterTrayBlueprints(newCharacterTrayTokens);

    if (targetContainerId === "floor-tray") {
      const overIdx = floorTrayBlueprints.findIndex(
        (blueprint) => blueprint.id === targetId
      );
      const atIdx = floorTrayBlueprints.findIndex(
        (blueprint) => blueprint.id === draggableId
      );
      assert(
        overIdx !== -1 || origin.location.type === LocationType.List,
        "Not over character-tray, but also origin is not character tray (or at least isn't the list location type)"
      );
      const destIdx =
        overIdx === -1 ? (origin.location as ListLocation).idx : overIdx;
      let newFloorTrayBlueprints = floorTrayBlueprints;
      if (atIdx !== -1) {
        newFloorTrayBlueprints = withoutItem(newFloorTrayBlueprints, atIdx);
      }
      newFloorTrayBlueprints = withItem(
        newFloorTrayBlueprints,
        {
          id: draggableId,
          contents: descriptor.contents,
        },
        destIdx
      );

      setFloorTrayBlueprints(newFloorTrayBlueprints);
    }

    setActiveDragDescriptor(undefined);
  };

  return (
    <div style={{ touchAction: "none" }}>
      <DndContext2
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragContainerChanged={onDragContainerChanged}
        collisionDetection={ttbudCollisionDetector}
        modifiers={[restrictToFloorTray]}
      >
        {/*Negative margin to cancel out the body margin because board cannot handle that :(*/}
        <Droppable2
          id="board"
          style={{ width: "100vw", height: "100vh", margin: "-8px" }}
        >
          <Board2
            activeFloor={activeFloor.contents}
            boardState={boardState}
            tempCharacter={tempBoardCharacter}
            isDragging={!!activeDragDescriptor}
            onFloorCreated={(activeFloor, gridPos) =>
              dispatch(addFloor(activeFloor, gridPos))
            }
            onPingCreated={noop}
            onTokenDeleted={noop}
          />
        </Droppable2>
        <div
          style={{
            display: "inline-block",
            position: "absolute",
            left: 100,
            top: 0,
          }}
        >
          <Droppable2 id="character-tray">
            <CharacterTray2
              items={characterTrayBlueprints}
              onCharacterRemoved={noop}
            />
          </Droppable2>
        </div>
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 0,
          }}
        >
          <Droppable2 id="floor-tray" style={{ display: "inline-flex" }}>
            <FloorTray2
              activeFloor={activeFloor}
              blueprints={floorTrayBlueprints}
              onFloorSelected={(tokenContents) => setActiveFloor(tokenContents)}
            />
          </Droppable2>
        </div>
        <DragOverlay activeDragDescriptor={activeDragDescriptor} />
      </DndContext2>
    </div>
  );
};

export default App2;
