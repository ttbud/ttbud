import {
  ConnectionStateType,
  ConnectionState,
  Disconnected,
  ConnectionError,
} from "./connection-state-slice";
import React from "react";
import Alert from "@material-ui/lab/Alert";
import { connect } from "react-redux";
import { RootState } from "../../store/rootReducer";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { makeStyles } from "@material-ui/core";

interface Props {
  connectionState: ConnectionState;
}

const useStyle = makeStyles(() => ({
  alert: {
    maxWidth: 500,
  },
}));

function disconnectMessage(state: Disconnected) {
  switch (state.error) {
    case ConnectionError.INVALID_ROOM_ID:
      return "Room link is invalid, try creating a new room";
    case ConnectionError.ROOM_FULL:
      return "This room is full";
    case ConnectionError.UNKNOWN:
      return "An unknown error has ocurred";
    default:
      throw new UnreachableCaseError(state.error);
  }
}

const PureConnectionNotifier: React.FC<Props> = ({ connectionState }) => {
  const classes = useStyle();

  switch (connectionState.type) {
    case ConnectionStateType.Connected:
      return null;
    case ConnectionStateType.Connecting:
      return (
        <Alert className={classes.alert} variant="filled" severity="warning">
          Connecting
        </Alert>
      );
    case ConnectionStateType.Disconnected:
      return (
        <Alert className={classes.alert} variant="filled" severity="error">
          Disconnected: {disconnectMessage(connectionState)}
        </Alert>
      );
    default:
      throw new UnreachableCaseError(connectionState);
  }
};

const mapStateToProps = (state: RootState) => ({
  connectionState: state.connectionState,
});

const ConnectionNotifier = connect(mapStateToProps)(PureConnectionNotifier);
export default ConnectionNotifier;
export { PureConnectionNotifier };
