import { createSlice } from "@reduxjs/toolkit";

export interface AppState {
  searching: boolean;
}

const initialState: AppState = {
  searching: false,
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
  },
});

export const { startSearching, stopSearching } = appSlice.actions;
export default appSlice.reducer;
