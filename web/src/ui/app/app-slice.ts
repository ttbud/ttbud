import { createSlice } from "@reduxjs/toolkit";
import { dragEnded } from "../../drag/drag-slice";

export interface AppState {
  searching: boolean;
  debug: boolean;
}

const initialState: AppState = {
  searching: false,
  debug: false,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    startSearching(state) {
      state.searching = true;
    },
    stopSearching(state) {
      state.searching = false;
    },
    toggleDebug(state) {
      state.debug = !state.debug;
    },
  },
  extraReducers: {
    [dragEnded.type]: (state) => {
      state.searching = false;
    },
  },
});

export const { startSearching, stopSearching, toggleDebug } = appSlice.actions;
export default appSlice.reducer;
