import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum ConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
}

const connectionStateSlice = createSlice({
  initialState: ConnectionState.Disconnected,
  name: "connection-state",
  reducers: {
    setConnectionState(state, newState: PayloadAction<ConnectionState>) {
      return newState.payload;
    },
  },
});

export const { setConnectionState } = connectionStateSlice.actions;
export default connectionStateSlice.reducer;
