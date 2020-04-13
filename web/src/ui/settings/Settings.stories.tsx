import Settings from "./Settings";
import React from "react";
import noop from "../../util/noop";

export default {
  component: Settings,
  title: "Settings",
};

export const Default: React.FC = () => (
  <Settings debugEnabled={false} onDebugToggled={noop} onClearMap={noop} />
);
