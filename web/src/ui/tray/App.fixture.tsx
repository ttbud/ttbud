import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  Modifiers,
  CollisionDetection,
  Modifier,
} from "@dnd-kit/core";
import {Transform} from "@dnd-kit/utilities"
import React, { useCallback, useRef, useState } from "react";
import { TokenDescriptor, TokenOrigin } from "../token/Character2/Draggable2";
import Character2 from "../token/Character2/Character2";
import { ContentType, EntityType, TokenContents, contentId } from "../../types";
import { ICONS, WALL_ICON } from "../icons";
import CharacterTray2, { Blueprint } from "./CharacterTray2";
import noop from "../../util/noop";
import { assert } from "../../util/invariants";
import {
  GridLocation,
  ListLocation,
  LocationType,
} from "../../drag/DragStateTypes";
import restrictToFloorTray from "./floorTrayDragsModifier";
import FloorTray2 from "./FloorTray2";
import FloorButton from "./FloorButton";
import Board2 from "../board/Board2";
import { BoardState, toPosStr } from "../board/board-state";
import ReactDOM, { createPortal } from "react-dom";
import ttbudCollisionDetector from "./TtbudCollisionDetector";

const WALL_CONTENTS = { type: ContentType.Icon, iconId: WALL_ICON.id } as const;

const defaultBoardState: BoardState = makeBoardStateFromBlueprint(
  makeToken(WALL_CONTENTS),
  { type: LocationType.Grid, x: 1, y: 1 }
);

function makeBoardStateFromBlueprint(
  { id, contents }: Blueprint,
  location: GridLocation
): BoardState {
  const pos = { x: location.x, y: location.y, z: 1 };

  return {
    charIdsByContentId: { [contentId(contents)]: [id] },
    entityById: {
      [id]: {
        id,
        pos,
        contents,
        type: EntityType.Character,
      },
    },
    tokenIdsByPosStr: {
      [toPosStr(pos)]: id,
    },
  };
}

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

interface MyDragOverChangedEvent {
  draggableId: string;
  origin: TokenOrigin;
  descriptor: TokenDescriptor;
  currentContainerId: string;
  currentOverId: string;
  lastContainerId: string;
}

interface MyDragStartEvent {
  draggableId: string;
  origin: TokenOrigin;
  descriptor: TokenDescriptor;
}

interface MyDragEndEvent {
  draggableId: string;
  origin: TokenOrigin;
  descriptor: TokenDescriptor;
  targetContainerId: string;
  targetId: string;
}

export type MyModifier = (args: Parameters<Modifier>[0] & {origin?: TokenOrigin}) => Transform;

interface MyDndContextProps {
  onDragContainerChanged: (event: MyDragOverChangedEvent) => void;
  onDragStart: (event: MyDragStartEvent) => void;
  onDragEnd: (event: MyDragEndEvent) => void;
  collisionDetection: CollisionDetection;
  modifiers: MyModifier[];
}

interface SortableData {
  sortable?: { containerId: string };
}

const MyDndContext: React.FC<MyDndContextProps> = ({
  onDragStart,
  onDragContainerChanged,
  onDragEnd,
  collisionDetection,
  modifiers,
  children,
}) => {
  const origin = useRef<TokenOrigin>();
  const lastContainer = useRef<string>();

  const dndkitModifiers = modifiers.map((modifier) => {
    return (args: Parameters<Modifier>[0]) => modifier({...args, origin: origin.current})
  })

  const myOnDragOver = ({ active, over, collisions }: DragOverEvent) => {
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    assert(origin.current !== undefined, "Origin is undefined on drag over");

    //TODO: Not this??
    if (over?.id === undefined) {
      return;
    }

    const currentOverId =
      (over?.id as string | undefined) ?? origin.current.containerId;
    // Instead of using the internals of the sortable library, can we just use the origin of the
    // over?
    const currentContainerId = over
      ? over?.data?.current?.sortable?.containerId ?? over.id
      : origin.current.containerId;

    const lastContainerId = lastContainer.current;
    assert(
      lastContainerId !== undefined,
      "lastContainerId is undefined on drag over"
    );

    console.log("onDragOver", {
      descriptor,
      over,
      currentOverId,
      currentContainerId,
      lastContainerId,
      origin: origin.current,
    });

    if (currentContainerId !== lastContainerId) {
      onDragContainerChanged({
        draggableId: active.id as string,
        origin: origin.current,
        currentContainerId,
        descriptor,
        currentOverId,
        lastContainerId,
      });
    }

    lastContainer.current = currentContainerId;
  };

  const myOnDragStart = ({ active }: DragStartEvent) => {
    const descriptor = active.data.current as TokenDescriptor;
    lastContainer.current = descriptor.origin.containerId;
    origin.current = descriptor.origin;
    onDragStart({
      draggableId: active.id as string,
      descriptor,
      origin: origin.current,
    });
  };

  const myOnDragEnd = ({ active, over }: DragEndEvent) => {
    assert(origin.current, "Origin is undefined on drag end");
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    const targetId =
      (over?.id as string | undefined) ?? origin.current.containerId;

    const targetContainerId = over
      ? over?.data?.current?.sortable?.containerId ?? over.id
      : origin.current.containerId;

    onDragEnd({
      draggableId: active.id as string,
      descriptor,
      targetId,
      targetContainerId,
      origin: origin.current,
    });
    lastContainer.current = undefined;
    origin.current = undefined;
  };

  return (
    <DndContext
      onDragStart={myOnDragStart}
      onDragOver={myOnDragOver}
      onDragEnd={myOnDragEnd}
      collisionDetection={collisionDetection}
      modifiers={dndkitModifiers}
    >
      {children}
    </DndContext>
  );
};

function withItem<T>(arr: Array<T>, item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index, arr.length)];
}

function withoutItem<T>(arr: Array<T>, index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1, arr.length)];
}

function withReplacedItem<T>(arr: Array<T>, item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index + 1, arr.length)];
}

interface OverlayProps {
  activeDragDescriptor: TokenDescriptor | undefined;
}

const TtbudDragOverlayContents: React.FC<OverlayProps> = ({
  activeDragDescriptor,
}) => {
  if (activeDragDescriptor === undefined) return null;
  console.log("in overlay", activeDragDescriptor);

  // return <Character2 contents={activeDragDescriptor.contents} />;
  if (activeDragDescriptor.origin.containerId === "floor-tray") {
    return (
      <FloorButton contents={activeDragDescriptor.contents} selected={true} />
    );
  } else {
    return <Character2 contents={activeDragDescriptor.contents} />;
  }
};

const CharacterWrapper: React.FC = () => {
  const [activeDragDescriptor, setActiveDragDescriptor] =
    useState<TokenDescriptor>();

  const [characterTrayTokens, setCharacterTrayTokens] =
    useState<Blueprint[]>(defaultChars);

  const [floorTrayBlueprints, setFloorTrayBlueprints] =
    useState<Blueprint[]>(defaultFloors);

  const [boardState, setBoardState] = useState(defaultBoardState);

  const onDragContainerChanged = useCallback(
    ({
      draggableId,
      descriptor,
      currentOverId,
      lastContainerId,
      currentContainerId,
      origin,
    }: MyDragOverChangedEvent) => {
      console.log("dragcontainerchanged", {
        draggableId,
        descriptor,
        currentContainerId,
        currentOverId,
        lastContainerId,
      });
      let newCharacterTrayTokens = characterTrayTokens;
      let newFloorTrayBlueprints = floorTrayBlueprints;
      let newBoardState = boardState;

      if (currentContainerId === "board") {
        const location =
          origin.location.type === LocationType.Grid
            ? origin.location
            : ({ type: LocationType.Grid, x: -1, y: -1, z: 0 } as const);
        newBoardState = makeBoardStateFromBlueprint(
          {
            id: draggableId,
            contents: descriptor.contents,
          },
          location
        );
      }

      if (lastContainerId === "board") {
        newBoardState = makeBoardStateFromBlueprint(
          makeToken(descriptor.contents),
          { type: LocationType.Grid, x: 0, y: 0 }
        );
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
          {
            id: draggableId,
            contents: descriptor.contents,
          },
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
        let overIdx = newCharacterTrayTokens.findIndex(
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
          overIdx = overIdx === -1 ? origin.location.idx : overIdx;
          newCharacterTrayTokens = withoutItem(
            newCharacterTrayTokens,
            origin.location.idx
          );
        }
        newCharacterTrayTokens = withItem(
          newCharacterTrayTokens,
          {
            id: draggableId,
            contents: descriptor.contents,
          },
          overIdx
        );
      }

      if (lastContainerId === "character-tray") {
        const currentIdx = characterTrayTokens.findIndex(
          (token) => token.id === draggableId
        );
        if (origin.containerId === "character-tray") {
          // Create a temporary token to hold the place of the token we're moving into the board
          newCharacterTrayTokens = withReplacedItem(
            newCharacterTrayTokens,
            makeToken(descriptor.contents),
            currentIdx
          );
        } else {
          // remove the token w/ the current draggable id, because it was temporary to show drag moviness
          newCharacterTrayTokens = withoutItem(
            newCharacterTrayTokens,
            currentIdx
          );
        }
      }

      let characterTrayDragging = newCharacterTrayTokens.find(
        (token) => token.id === draggableId
      );
      let floorTrayDragging = newFloorTrayBlueprints.find(
        (blueprint) => blueprint.id === draggableId
      );
      let boardDragging = newBoardState.entityById[draggableId] !== undefined;

      if (!(characterTrayDragging || floorTrayDragging || boardDragging)) {
        debugger;
      }

      assert(
        characterTrayDragging || floorTrayDragging || boardDragging,
        "Draggable isn't anywhere!!"
      );

      console.log({
        newCharacterTrayTokens,
        newFloorTrayBlueprints,
        newBoardState,
      });

      ReactDOM.unstable_batchedUpdates(() => {
        setCharacterTrayTokens(newCharacterTrayTokens);
        setFloorTrayBlueprints(newFloorTrayBlueprints);
        setBoardState(newBoardState);
      });
    },
    [boardState, characterTrayTokens, floorTrayBlueprints]
  );

  const onDragStart = ({ draggableId, descriptor }: MyDragStartEvent) => {
    console.log("onDragStart", { draggableId, descriptor });
    setActiveDragDescriptor(descriptor);
  };

  const onDragEnd = ({
    draggableId,
    descriptor,
    targetId,
    targetContainerId,
    origin,
  }: MyDragEndEvent) => {
    console.log("onDragEnd", {
      draggableId,
      descriptor,
      targetId,
      targetContainerId,
    });
    // Also handle drags onto board?

    let newCharacterTrayTokens = characterTrayTokens;
    if (targetContainerId === "character-tray") {
      const overIdx = characterTrayTokens.findIndex(
        (token) => token.id === targetId
      );
      const atIdx = characterTrayTokens.findIndex(
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
    setCharacterTrayTokens(newCharacterTrayTokens);

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
      <MyDndContext
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragContainerChanged={onDragContainerChanged}
        collisionDetection={ttbudCollisionDetector}
        modifiers={[restrictToFloorTray]}
      >
        {/*Negative margin to cancel out the body margin because board cannot handle that :(*/}
        <div style={{ width: "100vw", height: "100vh", margin: "-8px" }}>
          <Board2
            activeFloor={WALL_CONTENTS}
            boardState={boardState}
            isDragging={!!activeDragDescriptor}
            onFloorCreated={noop}
            onPingCreated={noop}
            onTokenDeleted={noop}
          />
        </div>
        <div
          style={{
            display: "inline-block",
            position: "absolute",
            left: 100,
            top: 0,
          }}
        >
          <CharacterTray2
            items={characterTrayTokens}
            onCharacterRemoved={noop}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 0,
          }}
        >
          <FloorTray2
            activeFloor={defaultActiveFloor}
            blueprints={floorTrayBlueprints}
          />
        </div>
        <DragOverlay>
          <TtbudDragOverlayContents
            activeDragDescriptor={activeDragDescriptor}
          />
        </DragOverlay>
      </MyDndContext>
    </div>
  );
};

export default CharacterWrapper;
