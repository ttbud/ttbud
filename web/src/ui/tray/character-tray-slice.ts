import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../../drag/drag-slice";
import { DROPPABLE_IDS } from "../DroppableIds";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import getDragResult from "../../drag/getDragResult";
import { reorderTokenBlueprints } from "./reorderTokenBlueprints";
import { contentId, ContentType, TokenContents } from "../../types";

const DEFAULT_CONTENTS: TokenContents[] = DEFAULT_CHARACTER_ICONS.map(
  (icon) => ({ type: ContentType.Icon, iconId: icon.id })
);

const characterTraySlice = createSlice({
  name: "characterTrayIcons",
  initialState: {
    characterBlueprints: DEFAULT_CONTENTS,
  },
  reducers: {
    removeCharacter(state, action: PayloadAction<TokenContents>) {
      const removedContentId = contentId(action.payload);
      state.characterBlueprints = state.characterBlueprints.filter(
        (contents) => contentId(contents) !== removedContentId
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(
      dragEnded,
      (state, action: PayloadAction<DragEndAction>) => {
        const { draggable, source, destination } = action.payload;

        const dragResult = getDragResult(
          DROPPABLE_IDS.CHARACTER_TRAY,
          action.payload
        );

        reorderTokenBlueprints({
          blueprints: state.characterBlueprints,
          draggable,
          source,
          destination,
          dragResult,
        });
      }
    );
  },
});

export const { removeCharacter } = characterTraySlice.actions;
export default characterTraySlice.reducer;
