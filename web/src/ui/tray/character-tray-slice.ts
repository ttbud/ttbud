import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import { ContentType } from "../../types";
import { arrayMove } from "@dnd-kit/sortable";
import { TokenBlueprint } from "./types";
import { v4 as uuid } from "uuid";

const DEFAULT_CONTENTS: TokenBlueprint[] = DEFAULT_CHARACTER_ICONS.map(
  (icon) => ({
    id: uuid(),
    contents: { type: ContentType.Icon, iconId: icon.id },
  })
);

interface AddCharacterAction {
  blueprint: TokenBlueprint;
  idx: number;
}

interface MoveCharacterAction {
  fromIdx: number;
  toIdx: number;
}

interface RenewCharacterAction {
  idx: number;
  newId: string;
}

const characterTraySlice = createSlice({
  name: "characterTrayIcons",
  initialState: {
    characterBlueprints: DEFAULT_CONTENTS,
  },
  reducers: {
    addCharacter(state, action: PayloadAction<AddCharacterAction>) {
      const { blueprint, idx } = action.payload;
      state.characterBlueprints.splice(idx, 0, blueprint);
    },
    moveCharacter(state, action: PayloadAction<MoveCharacterAction>) {
      const { fromIdx, toIdx } = action.payload;
      state.characterBlueprints = arrayMove(
        state.characterBlueprints,
        fromIdx,
        toIdx
      );
    },
    removeCharacter(state, action: PayloadAction<number>) {
      state.characterBlueprints.splice(action.payload, 1);
    },
    renewCharacter: {
      reducer: (state, action: PayloadAction<RenewCharacterAction>) => {
        const { idx, newId } = action.payload;
        state.characterBlueprints[idx].id = newId;
      },
      prepare: (idx: number) => {
        return { payload: { idx, newId: uuid() } };
      },
    },
  },
});

export const { addCharacter, moveCharacter, removeCharacter, renewCharacter } =
  characterTraySlice.actions;
export default characterTraySlice.reducer;
