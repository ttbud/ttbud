import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../../drag/drag-slice";
import { DROPPABLE_IDS } from "../DroppableIds";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import getDragResult from "../../drag/getDragResult";
import { reorderTokenSources } from "./reorderTokenSources";
import { contentId, ContentType, TokenContents } from "../../types";

const DEFAULT_CONTENTS: TokenContents[] = DEFAULT_CHARACTER_ICONS.map(
  (icon) => ({ type: ContentType.Icon, iconId: icon.id })
);

const characterTraySlice = createSlice({
  name: "characterTrayIcons",
  initialState: {
    characterSources: DEFAULT_CONTENTS,
  },
  reducers: {
    removeTokenSource(state, action: PayloadAction<TokenContents>) {
      const removedContentId = contentId(action.payload);
      state.characterSources = state.characterSources.filter(
        (contents) => contentId(contents) !== removedContentId
      );
    },
  },
  extraReducers: {
    [dragEnded.type]: (state, action: PayloadAction<DragEndAction>) => {
      const { draggable, source, destination } = action.payload;

      const dragResult = getDragResult(
        DROPPABLE_IDS.CHARACTER_TRAY,
        action.payload
      );

      reorderTokenSources({
        sources: state.characterSources,
        draggable,
        source,
        destination,
        dragResult,
      });
    },
  },
});

export const { removeTokenSource } = characterTraySlice.actions;
export default characterTraySlice.reducer;
