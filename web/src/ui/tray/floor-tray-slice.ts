import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../../drag/drag-slice";
import { DROPPABLE_IDS } from "../DroppableIds";
import { DEFAULT_FLOOR_ICONS } from "../icons";
import { assert } from "../../util/invariants";
import getDragResult from "../../drag/getDragResult";
import { reorderTokenSources } from "./reorderTokenSources";
import { contentId, ContentType, TokenContents } from "../../types";

const DEFAULT_FLOOR_SOURCES: TokenContents[] = DEFAULT_FLOOR_ICONS.map(
  (icon) => ({ type: ContentType.Icon, iconId: icon.id })
);

const floorTraySlice = createSlice({
  name: "floorTrayIcons",
  initialState: {
    floorSources: DEFAULT_FLOOR_SOURCES,
    activeFloor: DEFAULT_FLOOR_SOURCES[0],
  },
  reducers: {
    setActiveFloor(state, action: PayloadAction<TokenContents>) {
      const activeContents = action.payload;
      const activeFloorId = contentId(activeContents);
      assert(
        state.floorSources.some(
          (source) => contentId(source) === activeFloorId
        ),
        `Contents ${activeContents} cannot be the active floor because it is not in the tray`
      );
      state.activeFloor = activeContents;
    },
    removeIcon(state, action: PayloadAction<TokenContents>) {
      const removedFloorId = contentId(action.payload);
      state.floorSources = state.floorSources.filter(
        (source) => contentId(source) !== removedFloorId
      );
    },
  },
  extraReducers: {
    [dragEnded.type]: (state, action: PayloadAction<DragEndAction>) => {
      const { draggable, destination, source } = action.payload;
      const dragResult = getDragResult(
        DROPPABLE_IDS.FLOOR_TRAY,
        action.payload
      );

      reorderTokenSources({
        sources: state.floorSources,
        draggable,
        source,
        destination,
        dragResult,
      });
    },
  },
});

export default floorTraySlice.reducer;

export const { setActiveFloor, removeIcon } = floorTraySlice.actions;
