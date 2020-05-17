import { PureConnectionNotifier } from "./ConnectionNotifier";
import { ConnectionStateType, ConnectionError } from "./connection-state-slice";
import React from "react";

const Disconnected: React.FC<{ error: ConnectionError }> = ({ error }) => (
  <PureConnectionNotifier
    connectionState={{ type: ConnectionStateType.Disconnected, error: error }}
  />
);

export default {
  Connecting: (
    <PureConnectionNotifier
      connectionState={{ type: ConnectionStateType.Connecting }}
    />
  ),
  "Room Full": <Disconnected error={ConnectionError.ROOM_FULL} />,
  "Invalid Room Id": <Disconnected error={ConnectionError.INVALID_ROOM_ID} />,
  Unknown: <Disconnected error={ConnectionError.UNKNOWN} />,
};
