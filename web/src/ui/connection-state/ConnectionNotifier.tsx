import { ConnectionState } from "./connection-state-slice";
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

const PureConnectionNotifier: React.FC<Props> = ({ connectionState }) => {
  const classes = useStyle();

  switch (connectionState) {
    case ConnectionState.Connected:
      return null;
    case ConnectionState.Connecting:
      return (
        <Alert className={classes.alert} variant="filled" severity="warning">
          Connecting
        </Alert>
      );
    case ConnectionState.Disconnected:
      return (
        <Alert className={classes.alert} variant="filled" severity="error">
          Disconnected
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
