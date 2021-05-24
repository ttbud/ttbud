import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ConnectionError } from "../../network/BoardStateApiClient";

export enum ConnectionStateType {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
}

export interface Disconnected {
  type: ConnectionStateType.Disconnected;
  numRetries: number;
  error: ConnectionError;
}

export interface Connected {
  type: ConnectionStateType.Connected;
}

export interface Connecting {
  type: ConnectionStateType.Connecting;
  numRetries: number;
}

export type ConnectionState = Connecting | Connected | Disconnected;

const connectionStateSlice = createSlice({
  initialState: {
    type: ConnectionStateType.Connecting,
    numRetries: 0,
  } as ConnectionState,
  name: "connection-state",
  reducers: {
    connected() {
      return { type: ConnectionStateType.Connected };
    },
    connecting(state) {
      const numRetries = "numRetries" in state ? state.numRetries + 1 : 0;
      return {
        type: ConnectionStateType.Connecting,
        numRetries,
      };
    },
    disconnected(
      state: ConnectionState,
      action: PayloadAction<{ error: ConnectionError }>
    ) {
      return {
        type: ConnectionStateType.Disconnected,
        numRetries: "numRetries" in state ? state.numRetries : 0,
        error: action.payload.error,
      };
    },
  },
});

export const { connected, connecting, disconnected } =
  connectionStateSlice.actions;
export default connectionStateSlice.reducer;
