import { TokenBlueprint } from "./types";
import { useCallback, useMemo, useState } from "react";
import { DROPPABLE_IDS } from "../DroppableIds";
import { DragSourceId } from "../drag/types";
import {
  withItemAt,
  withItemMoved,
  withItemReplaced,
  withoutItemAt,
} from "../../util/arr";
import { v4 as uuid } from "uuid";

interface AddItemAction {
  idx: number;
  bp: TokenBlueprint;
  src: DragSourceId;
}

function blueprintToItem(
  bp: TokenBlueprint,
  src: DragSourceId = DROPPABLE_IDS.CHARACTER_TRAY
) {
  return {
    id: bp.id,
    descriptor: {
      type: "character",
      contents: bp.contents,
      source: src,
    } as const,
  };
}

export default function useTrayItems(defaultBlueprints: TokenBlueprint[]) {
  const defaultItems = useMemo(() => {
    return defaultBlueprints.map((item) => blueprintToItem(item));
  }, [defaultBlueprints]);

  const [items, setItems] = useState(defaultItems);

  const addItem = useCallback(
    ({ idx, bp, src = DROPPABLE_IDS.CHARACTER_TRAY }: AddItemAction) => {
      setItems(withItemAt(items, blueprintToItem(bp, src), idx));
    },
    [items]
  );

  const removeItem = useCallback(
    (idx: number) => setItems(withoutItemAt(items, idx)),
    [items]
  );

  const moveItem = useCallback(
    (fromIdx: number, toIdx: number) => {
      setItems(withItemMoved(items, fromIdx, toIdx));
    },
    [items]
  );

  const renewItemId = useCallback(
    (idx: number) => {
      setItems(withItemReplaced(items, { ...items[idx], id: uuid() }, idx));
    },
    [items]
  );

  return useMemo(
    () => ({
      items,
      addItem,
      moveItem,
      removeItem,
      renewItemId,
    }),
    [items, addItem, moveItem, removeItem, renewItemId]
  );
}

export type TrayItems = ReturnType<typeof useTrayItems>;
