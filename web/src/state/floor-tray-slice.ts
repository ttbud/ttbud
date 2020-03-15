import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../drag/drag-slice";
import { DROPPABLE_IDS } from "../ui/DroppableIds";
import { DEFAULT_FLOOR_ICONS, Icon } from "../ui/icons";
import { assert } from "../util/invariants";
import getDragResult from "./getDragResult";
import { reorderIcons } from "./reorderIcons";

const floorTraySlice = createSlice({
  name: "floorTrayIcons",
  initialState: {
    icons: DEFAULT_FLOOR_ICONS,
    activeFloor: DEFAULT_FLOOR_ICONS[0]
  },
  reducers: {
    setActiveFloor(state, action: PayloadAction<Icon>) {
      const activeIcon = action.payload;
      assert(
        state.icons.some(icon => icon.id === activeIcon.id),
        `Icon ${activeIcon.id} cannot be the active floor because it is not in the tray`
      );
      state.activeFloor = activeIcon;
    },
    removeIcon(state, action: PayloadAction<Icon>) {
      state.icons = state.icons.filter(icon => icon.id !== action.payload.id);
    }
  },
  extraReducers: {
    [dragEnded.type]: (state, action: PayloadAction<DragEndAction>) => {
      const { draggable, destination, source } = action.payload;
      const dragResult = getDragResult(
        DROPPABLE_IDS.FLOOR_TRAY,
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

export default floorTraySlice.reducer;

export const { setActiveFloor, removeIcon } = floorTraySlice.actions;
