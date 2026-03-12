import { createSlice } from "@reduxjs/toolkit";

export interface SettingsState {
  showTourPrompt: boolean;
  measureWhileDragging: boolean;
}

const initialState: SettingsState = {
  showTourPrompt: true,
  measureWhileDragging: true,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    dismissTourPrompt(state) {
      state.showTourPrompt = false;
    },
    setMeasureWhileDragging(state, action: { payload: boolean }) {
      state.measureWhileDragging = action.payload;
    },
  },
});

export const { dismissTourPrompt, setMeasureWhileDragging } =
  settingsSlice.actions;
export default settingsSlice.reducer;
