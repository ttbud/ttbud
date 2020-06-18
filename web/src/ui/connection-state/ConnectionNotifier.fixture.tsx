import { PureConnectionNotifier } from "./ConnectionNotifier";
import { ConnectionStateType } from "./connection-state-slice";
import React from "react";
import noop from "../../util/noop";
import { ConnectionError } from "../../network/BoardStateApiClient";

const Disconnected: React.FC<{ error: ConnectionError }> = ({ error }) => (
  <PureConnectionNotifier
    connectionState={{ type: ConnectionStateType.Disconnected, error: error }}
    onReconnectClick={noop}
  />
);

export default {
  Connecting: (
    <PureConnectionNotifier
      connectionState={{ type: ConnectionStateType.Connecting }}
      onReconnectClick={noop}
    />
  ),
  "Room Full": <Disconnected error={ConnectionError.ROOM_FULL} />,
  "Invalid Room Id": <Disconnected error={ConnectionError.INVALID_ROOM_ID} />,
  Unknown: <Disconnected error={ConnectionError.UNKNOWN} />,
};
