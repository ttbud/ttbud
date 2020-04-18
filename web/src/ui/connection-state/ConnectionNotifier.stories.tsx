import ConnectionNotifier, {
  PureConnectionNotifier,
} from "./ConnectionNotifier";
import { ConnectionStateType, ConnectionError } from "./connection-state-slice";
import React from "react";

export default {
  component: ConnectionNotifier,
  title: "ConnectionNotifier",
};

const Disconnected: React.FC<{ error: ConnectionError }> = ({ error }) => (
  <PureConnectionNotifier
    connectionState={{ type: ConnectionStateType.Disconnected, error: error }}
  />
);

export const Connecting: React.FC = () => (
  <PureConnectionNotifier
    connectionState={{ type: ConnectionStateType.Connecting }}
  />
);

export const RoomFull: React.FC = () => (
  <Disconnected error={ConnectionError.ROOM_FULL} />
);

export const InvalidRoomId: React.FC = () => (
  <Disconnected error={ConnectionError.INVALID_ROOM_ID} />
);

export const Unknown: React.FC = () => (
  <Disconnected error={ConnectionError.UNKNOWN} />
);
