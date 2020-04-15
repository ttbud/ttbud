import ConnectionNotifier, {
  PureConnectionNotifier,
} from "./ConnectionNotifier";
import { ConnectionState } from "./connection-state-slice";
import React from "react";

export default {
  component: ConnectionNotifier,
  title: "ConnectionNotifier",
};

export const Connecting: React.FC = () => (
  <PureConnectionNotifier connectionState={ConnectionState.Connecting} />
);
export const Disconnected: React.FC = () => (
  <PureConnectionNotifier connectionState={ConnectionState.Disconnected} />
);
