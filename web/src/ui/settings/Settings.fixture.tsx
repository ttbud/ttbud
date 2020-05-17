import Settings from "./Settings";
import React, { useState } from "react";
import noop from "../../util/noop";

export default () => {
  const [debugEnabled, setDebugEnabled] = useState(false);
  return (
    <Settings
      debugEnabled={debugEnabled}
      onDebugToggled={() => setDebugEnabled(!debugEnabled)}
      onClearMap={noop}
    />
  );
};
