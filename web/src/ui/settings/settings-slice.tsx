import { createSlice } from "@reduxjs/toolkit";

export interface SettingsState {
  debug: boolean;
  showTourPrompt: boolean;
}

const initialState: SettingsState = {
  debug: false,
  showTourPrompt: true,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    dismissTourPrompt(state) {
      state.showTourPrompt = false;
    },
    toggleDebug(state) {
      state.debug = !state.debug;
    },
  },
});

export const { dismissTourPrompt, toggleDebug } = settingsSlice.actions;
export default settingsSlice.reducer;
