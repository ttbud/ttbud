import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import React, { useCallback, useRef, useState } from "react";
import Draggable2, { TokenDescriptor } from "../../../drag/Draggable2";
import Character2 from "../../token/Character2/Character2";
import { ContentType, TokenContents, contentId } from "../../../types";
import { ICONS, WALL_ICON } from "../../icons";
import CharacterTray2, { Blueprint } from "./CharacterTray2";
import noop from "../../../util/noop";
import { assert } from "../../../util/invariants";
import { LocationType } from "../../../drag/DragStateTypes";

const wall = { type: ContentType.Icon, iconId: WALL_ICON.id } as const;

function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, "0");
}

function randSuffix() {
  const arr = new Uint8Array(5 / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}

const defaultChars: Blueprint[] = ICONS.slice(0, 50).map((icon) =>
  makeToken({ type: ContentType.Icon, iconId: icon.id })
);

const defaultBoardToken: Blueprint = makeToken(wall);

function makeToken(content: TokenContents): Blueprint {
  return {
    id: `${contentId(content)}-${randSuffix()}`,
    contents: content,
  };
}

interface MyDragOverChangedEvent {
  draggableId: string;
  descriptor: TokenDescriptor;
  currentContainerId: string;
  currentOverId: string;
  lastContainerId: string;
}

interface MyDragStartEvent {
  draggableId: string;
  descriptor: TokenDescriptor;
}

interface MyDragEndEvent {
  draggableId: string;
  descriptor: TokenDescriptor;
  targetContainerId: string;
  targetId: string;
}

interface MyDndContextProps {
  onDragContainerChanged: (event: MyDragOverChangedEvent) => void;
  onDragStart: (event: MyDragStartEvent) => void;
  onDragEnd: (event: MyDragEndEvent) => void;
}

interface SortableData {
  sortable?: { containerId: string };
}

const MyDndContext: React.FC<MyDndContextProps> = ({
  onDragStart,
  onDragContainerChanged,
  onDragEnd,
  children,
}) => {
  const lastContainer = useRef<string>();

  const myOnDragOver = ({ active, over }: DragOverEvent) => {
    const descriptor = active.data.current as TokenDescriptor & SortableData;

    const currentOverId =
      (over?.id as string | undefined) ?? descriptor.origin.containerId;
    const currentContainerId = over
      ? over?.data?.current?.sortable.containerId ?? over.id
      : descriptor.origin.containerId;

    const lastContainerId = lastContainer.current;
    assert(
      lastContainerId !== undefined,
      "lastContainerId is undefined on drag over"
    );

    if (currentContainerId !== lastContainerId) {
      onDragContainerChanged({
        draggableId: active.id as string,
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
    onDragStart({ draggableId: active.id as string, descriptor });
  };

  const myOnDragEnd = ({ active, over }: DragEndEvent) => {
    const descriptor = active.data.current as TokenDescriptor & SortableData;
    const targetId =
      (over?.id as string | undefined) ?? descriptor.origin.containerId;
    const targetContainerId = over
      ? over?.data?.current?.sortable.containerId ?? over.id
      : descriptor.origin.containerId;

    onDragEnd({
      draggableId: active.id as string,
      descriptor,
      targetId,
      targetContainerId,
    });
    lastContainer.current = undefined;
  };

  return (
    <DndContext
      onDragStart={myOnDragStart}
      onDragOver={myOnDragOver}
      onDragEnd={myOnDragEnd}
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

const CharacterWrapper: React.FC = () => {
  const [dragContent, setDragContent] = useState<TokenContents>();
  const [characterTrayTokens, setCharacterTrayTokens] =
    useState<Blueprint[]>(defaultChars);
  const [boardToken, setBoardToken] = useState(defaultBoardToken);

  const onDragContainerChanged = useCallback(
    ({
      draggableId,
      descriptor,
      currentOverId,
      lastContainerId,
      currentContainerId,
    }: MyDragOverChangedEvent) => {
      console.log("dragcontainerchanged", {
        draggableId,
        descriptor,
        currentContainerId,
        currentOverId,
        lastContainerId,
      });
      let newCharacterTrayTokens = characterTrayTokens;

      if (currentContainerId === "board") {
        setBoardToken({ id: draggableId, contents: descriptor.contents });
      }

      if (lastContainerId === "board") {
        setBoardToken(makeToken(descriptor.contents));
      }

      if (currentContainerId === "character-tray") {
        const overIdx = newCharacterTrayTokens.findIndex(
          (token) => token.id === currentOverId
        );

        assert(overIdx !== -1, "Not over anything in character tray?");
        if (descriptor.origin.containerId === "character-tray") {
          assert(
            descriptor.origin.location.type === LocationType.List,
            "It's in character tray but not a list?"
          );
          newCharacterTrayTokens = withoutItem(
            newCharacterTrayTokens,
            descriptor.origin.location.idx
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
        if (descriptor.origin.containerId === "character-tray") {
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

      setCharacterTrayTokens(newCharacterTrayTokens);
    },
    [characterTrayTokens]
  );

  const onDragStart = ({ draggableId, descriptor }: MyDragStartEvent) => {
    console.log("onDragStart", { draggableId, descriptor });
    setDragContent(descriptor.contents);
  };

  const onDragEnd = ({
    draggableId,
    descriptor,
    targetId,
    targetContainerId,
  }: MyDragEndEvent) => {
    console.log("onDragEnd", {
      draggableId,
      descriptor,
      targetId,
      targetContainerId,
    });
    setDragContent(undefined);
  };

  return (
    <div style={{ touchAction: "none" }}>
      <MyDndContext
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragContainerChanged={onDragContainerChanged}
      >
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
        <Draggable2
          id={boardToken.id}
          descriptor={{
            contents: boardToken.contents,
            origin: {
              containerId: "board",
              location: { x: 0, y: 0, type: LocationType.Grid },
            },
          }}
        >
          <Character2
            contents={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
          />
        </Draggable2>
        <DragOverlay>
          {dragContent && <Character2 contents={dragContent} />}
        </DragOverlay>
      </MyDndContext>
    </div>
  );
};

export default CharacterWrapper;
