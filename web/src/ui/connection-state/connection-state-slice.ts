import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum ConnectionStateType {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
}

export enum ConnectionError {
  ROOM_FULL = "room full",
  INVALID_ROOM_ID = "invalid room id",
  UNKNOWN = "unknown",
}

export interface Disconnected {
  type: ConnectionStateType.Disconnected;
  error: ConnectionError;
}

export type ConnectionState =
  | { type: ConnectionStateType.Connecting | ConnectionStateType.Connected }
  | Disconnected;

const connectionStateSlice = createSlice({
  initialState: { type: ConnectionStateType.Connecting } as ConnectionState,
  name: "connection-state",
  reducers: {
    setConnectionState(state, newState: PayloadAction<ConnectionState>) {
      return newState.payload;
    },
  },
});

export const { setConnectionState } = connectionStateSlice.actions;
export default connectionStateSlice.reducer;
