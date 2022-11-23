import {
  addPing,
  CHARACTER_HEIGHT,
  FLOOR_HEIGHT,
  removeEntity,
  setCharacterDragId,
  upsertToken,
} from "./board-slice";
import Pos2d, { centerOf } from "../../util/shape-math";
import { v4 as uuid } from "uuid";
import { EntityType, TokenContents } from "../../types";
import { useDispatch } from "react-redux";
import { useCallback, useMemo } from "react";
import { ClientRect } from "@dnd-kit/core";
import { toGridPos } from "./useBoardInputMonitor";

export function useBoardActions(activeFloor: TokenContents) {
  const dispatch = useDispatch();

  const onDelete = useCallback(
    (entityId: string) => {
      dispatch(removeEntity(entityId));
    },
    [dispatch]
  );

  const onPing = useCallback(
    (pos: Pos2d) => {
      dispatch(addPing(pos));
    },
    [dispatch]
  );

  const onDraw = useCallback(
    (pos: Pos2d) => {
      dispatch(
        upsertToken({
          id: uuid(),
          type: EntityType.Floor,
          contents: activeFloor,
          pos: { ...pos, z: FLOOR_HEIGHT },
        })
      );
    },
    [activeFloor, dispatch]
  );

  const onDrop = useCallback(
    (
      id: string,
      dragId: string,
      draggableRect: ClientRect,
      contents: TokenContents
    ) => {
      //TODO: I don't like calling toGridPos here :(
      const gridPos = toGridPos(centerOf(draggableRect));
      dispatch(
        upsertToken({
          id,
          dragId,
          type: EntityType.Character,
          pos: { ...gridPos, z: CHARACTER_HEIGHT },
          contents,
        })
      );
    },
    [dispatch]
  );

  const onDragOff = useCallback(
    (characterId: string) => {
      dispatch(setCharacterDragId({ characterId, dragId: "dragging off" }));
    },
    [dispatch]
  );

  const onDragReturn = useCallback((characterId: string, dragId: string) => {
    dispatch(setCharacterDragId({ characterId, dragId }));
  }, []);

  return useMemo(
    () => ({ onDelete, onPing, onDraw, onDrop, onDragOff, onDragReturn }),
    [onDelete, onPing, onDraw, onDrop, onDragOff, onDragReturn]
  );
}

export type BoardActions = ReturnType<typeof useBoardActions>;
