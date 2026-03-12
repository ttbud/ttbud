import { PureSettings } from "./Settings";
import React, { useState } from "react";
import noop from "../../util/noop";

export default function SettingsFixture() {
  const [showTourPrompt, setShowTourPrompt] = useState(true);
  const [measureWhileDragging, setMeasureWhileDragging] = useState(true);

  return (
    <PureSettings
      showTourPrompt={showTourPrompt}
      measureWhileDragging={measureWhileDragging}
      onClearMap={noop}
      onTourClicked={noop}
      onTourPromptDismissed={() => setShowTourPrompt(false)}
      onMeasureWhileDraggingChanged={setMeasureWhileDragging}
    />
  );
}
