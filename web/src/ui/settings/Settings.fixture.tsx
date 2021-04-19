import { PureSettings } from "./Settings";
import React, { useState } from "react";
import noop from "../../util/noop";

export default function SettingsFixture() {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [showTourPrompt, setShowTourPrompt] = useState(true);

  return (
    <PureSettings
      debugEnabled={debugEnabled}
      onDebugToggled={() => setDebugEnabled(!debugEnabled)}
      showTourPrompt={showTourPrompt}
      onClearMap={noop}
      onTourClicked={noop}
      onTourPromptDismissed={() => setShowTourPrompt(false)}
    />
  );
}
