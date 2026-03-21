import { PureSettings } from "./Settings";
import React, { useState } from "react";
import noop from "../../util/noop";

import { GridType } from "../../types";

export default function SettingsFixture() {
  const [showTourPrompt, setShowTourPrompt] = useState(true);
  const [gridType, setGridType] = useState(GridType.Square);

  return (
    <PureSettings
      showTourPrompt={showTourPrompt}
      gridType={gridType}
      onClearMap={noop}
      onTourClicked={noop}
      onTourPromptDismissed={() => setShowTourPrompt(false)}
      onGridTypeChanged={setGridType}
    />
  );
}
