import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../drag/drag-slice";
import { getDragResult } from "../drag/util";
import { reorderIcons } from "./util";
import { Icon, ICONS, IconType, WALL_ICON } from "../ui/icons";
import { DROPPABLE_IDS } from "../ui/DropIds";
import { assert } from "../util/invariant";

export interface FloorTrayState {
  icons: Icon[];
  activeFloor: Icon;
}

const DEFAULT_ICONS = ICONS.filter(icon => icon.type === IconType.floor)
  .take(4)
  .unshift(WALL_ICON)
  .toArray();

const floorTraySlice = createSlice({
  name: "floorTrayIcons",
  initialState: {
    icons: DEFAULT_ICONS,
    activeFloor: WALL_ICON
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
    deleteIcon(state, action: PayloadAction<Icon>) {
      state.icons = state.icons.filter(icon => icon.id !== action.payload.id);
    },
    replaceIcons(state, action: PayloadAction<Icon[]>) {
      state.icons = action.payload;
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
export const { replaceIcons, setActiveFloor } = floorTraySlice.actions;
