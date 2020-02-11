import { createSlice } from "@reduxjs/toolkit";
import { dragEnded } from "./drag-slice";

export interface AppState {
  searching: boolean;
}

const initialState: AppState = {
  searching: false
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
    }
  },
  extraReducers: {
    [dragEnded.type]: state => {
      state.searching = false;
    }
  }
});

export const { startSearching, stopSearching } = appSlice.actions;
export default appSlice.reducer;
