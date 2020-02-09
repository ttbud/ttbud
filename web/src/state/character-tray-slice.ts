import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Icon, ICONS, IconType } from "../ui/icons";
import { DragEndAction, dragEnded } from "../drag/drag-slice";
import { getDragResult } from "../drag/util";
import { DROPPABLE_IDS } from "../ui/DropIds";
import { reorderIcons } from "./util";

const DEFAULT_ICONS = ICONS.filter(icon => icon.type === IconType.token)
  .take(5)
  .toArray();

export interface CharacterTrayState {
  icons: Icon[];
}

const characterTraySlice = createSlice({
  name: "characterTrayIcons",
  initialState: {
    icons: DEFAULT_ICONS
  },
  reducers: {
    replaceIcons(state, action: PayloadAction<Icon[]>) {
      state.icons = action.payload;
    },
    deleteIcon(state, action: PayloadAction<Icon>) {
      state.icons = state.icons.filter(icon => icon.id !== action.payload.id);
    }
  },
  extraReducers: {
    [dragEnded.type]: (state, action: PayloadAction<DragEndAction>) => {
      const { draggable, source, destination } = action.payload;
      const dragResult = getDragResult(
        DROPPABLE_IDS.CHARACTER_TRAY,
        action.payload
      );

      reorderIcons({
        icons: state.icons,
        draggable,
        source,
        destination,
        dragResult
      });
    }
  }
});

export const { replaceIcons, deleteIcon } = characterTraySlice.actions;
export default characterTraySlice.reducer;
