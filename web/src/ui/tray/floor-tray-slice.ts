import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../../drag/drag-slice";
import { DROPPABLE_IDS } from "../DroppableIds";
import { DEFAULT_FLOOR_ICONS } from "../icons";
import { assert } from "../../util/invariants";
import getDragResult from "../../drag/getDragResult";
import { reorderTokenBlueprints } from "./reorderTokenBlueprints";
import { contentId, ContentType, TokenContents } from "../../types";
import {current} from 'immer'

const DEFAULT_FLOOR_BLUEPRINTS: TokenContents[] = DEFAULT_FLOOR_ICONS.map(
  (icon) => ({ type: ContentType.Icon, iconId: icon.id })
);

const floorTraySlice = createSlice({
  name: "floorTrayIcons",
  initialState: {
    floorBlueprints: DEFAULT_FLOOR_BLUEPRINTS,
    activeFloor: DEFAULT_FLOOR_BLUEPRINTS[0],
  },
  reducers: {
    setActiveFloor(state, action: PayloadAction<TokenContents>) {
      const activeContents = action.payload;
      const activeFloorId = contentId(activeContents);
      console.log(current(state.floorBlueprints), "Floor tray contents")
      console.log(activeFloorId, "activeFloorId")
      assert(
        state.floorBlueprints.some(
          (blueprint) => contentId(blueprint) === activeFloorId
        ),
        `Contents ${activeContents} cannot be the active floor because it is not in the tray`
      );
      state.activeFloor = activeContents;
    },
    removeIcon(state, action: PayloadAction<TokenContents>) {
      const removedFloorId = contentId(action.payload);
      state.floorBlueprints = state.floorBlueprints.filter(
        (blueprint) => contentId(blueprint) !== removedFloorId
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

      reorderTokenBlueprints({
        blueprints: state.floorBlueprints,
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
