import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_FLOOR_ICONS } from "../icons";
import { assert } from "../../util/invariants";
import { contentId, ContentType, TokenContents } from "../../types";
import { arrayMove } from "@dnd-kit/sortable";
import { v4 as uuid } from "uuid";
import { TokenBlueprint } from "./types";

const DEFAULT_FLOOR_BLUEPRINTS: TokenBlueprint[] = DEFAULT_FLOOR_ICONS.map(
  (icon) => ({
    id: uuid(),
    contents: { type: ContentType.Icon, iconId: icon.id },
  })
);

interface AddIconAction {
  blueprint: TokenBlueprint;
  idx: number;
}

interface MoveIconAction {
  fromIdx: number;
  toIdx: number;
}

interface RenewIconAction {
  idx: number;
  newId: string;
}

const floorTraySlice = createSlice({
  name: "floorTrayIcons",
  initialState: {
    floorBlueprints: DEFAULT_FLOOR_BLUEPRINTS,
    activeFloor: DEFAULT_FLOOR_BLUEPRINTS[0].contents,
  },
  reducers: {
    setActiveFloor(state, action: PayloadAction<TokenContents>) {
      const activeContents = action.payload;
      const activeFloorId = contentId(activeContents);
      assert(
        state.floorBlueprints.some(
          (blueprint) => contentId(blueprint.contents) === activeFloorId
        ),
        `Contents ${activeContents} cannot be the active floor because it is not in the tray`
      );
      state.activeFloor = activeContents;
    },
    renewIcon: {
      reducer: (state, action: PayloadAction<RenewIconAction>) => {
        const { idx, newId } = action.payload;
        state.floorBlueprints[idx].id = newId;
      },
      prepare: (idx: number) => ({ payload: { idx, newId: uuid() } }),
    },
    addFloor(state, action: PayloadAction<AddIconAction>) {
      const { idx, blueprint } = action.payload;
      state.floorBlueprints.splice(idx, 0, blueprint);
    },
    moveFloor(state, action: PayloadAction<MoveIconAction>) {
      const { fromIdx, toIdx } = action.payload;
      state.floorBlueprints = arrayMove(state.floorBlueprints, fromIdx, toIdx);
    },
    removeFloor(state, action: PayloadAction<number>) {
      state.floorBlueprints.splice(action.payload, 1);
    },
  },
});

export default floorTraySlice.reducer;

export const { setActiveFloor, addFloor, moveFloor, removeFloor } =
  floorTraySlice.actions;
