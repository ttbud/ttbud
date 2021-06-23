import { PureConnectionNotifier } from "./ConnectionNotifier";
import { ConnectionStateType } from "./connection-state-slice";
import noop from "../../util/noop";
import { ConnectionError } from "../../network/BoardStateApiClient";

const Disconnected: React.FC<{ error: ConnectionError }> = ({ error }) => (
  <PureConnectionNotifier
    connectionState={{
      type: ConnectionStateType.Disconnected,
      error: error,
      numRetries: 0,
    }}
    onReconnectClick={noop}
  />
);

const connectionFixtures = {
  Connecting: (
    <PureConnectionNotifier
      connectionState={{ type: ConnectionStateType.Connecting, numRetries: 0 }}
      onReconnectClick={noop}
    />
  ),
  "Room Full": <Disconnected error={ConnectionError.ROOM_FULL} />,
  "Invalid Room Id": <Disconnected error={ConnectionError.INVALID_ROOM_ID} />,
  Unknown: <Disconnected error={ConnectionError.UNKNOWN} />,
};

export default connectionFixtures;
