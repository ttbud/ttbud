import { createSlice } from "@reduxjs/toolkit";

export interface SettingsState {
  showTourPrompt: boolean;
}

const initialState: SettingsState = {
  showTourPrompt: true,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    dismissTourPrompt(state) {
      state.showTourPrompt = false;
    },
  },
});

export const { dismissTourPrompt } = settingsSlice.actions;
export default settingsSlice.reducer;
