import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../drag/drag-slice";
import { DROPPABLE_IDS } from "../ui/DroppableIds";
import { DEFAULT_CHARACTER_ICONS, Icon } from "../ui/icons";
import getDragResult from "./getDragResult";
import { reorderIcons } from "./reorderIcons";

const characterTraySlice = createSlice({
  name: "characterTrayIcons",
  initialState: {
    icons: DEFAULT_CHARACTER_ICONS
  },
  reducers: {
    removeIcon(state, action: PayloadAction<Icon>) {
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

export const { removeIcon } = characterTraySlice.actions;
export default characterTraySlice.reducer;
