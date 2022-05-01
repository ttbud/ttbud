import {
  addPing,
  CHARACTER_HEIGHT,
  FLOOR_HEIGHT,
  removeEntity,
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

  const onDelete = useCallback((entityId: string) => {
    dispatch(removeEntity(entityId));
  }, [dispatch]);

  const onPing = useCallback((pos: Pos2d) => {
    dispatch(addPing(pos));
  }, [dispatch]);

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
    (id: string, draggableRect: ClientRect, contents: TokenContents) => {
      //TODO: I don't like calling toGridPos here :(
      const gridPos = toGridPos(centerOf(draggableRect));
      dispatch(
        upsertToken({
          type: EntityType.Character,
          pos: { ...gridPos, z: CHARACTER_HEIGHT },
          id,
          contents,
        })
      );
    },
    [dispatch]
  );

  return useMemo(
    () => ({ onDelete, onPing, onDraw, onDrop }),
    [onDelete, onPing, onDraw, onDrop]
  );
}
