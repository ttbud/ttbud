import React from "react";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import Character from "./Character";
import { ContentType, IconContents } from "../../types";

const ICON = DEFAULT_CHARACTER_ICONS[0];
const DEFAULT_PROPS = {
  contents: { type: ContentType.Icon, iconId: ICON.id } as IconContents,
  style: { width: 40, height: 40 },
  isDragging: false,
};

export default {
  Default: <Character {...DEFAULT_PROPS} />,
  Text: (
    <Character
      {...DEFAULT_PROPS}
      contents={{ type: ContentType.Text, text: "LP" }}
    />
  ),
  Dragging: <Character {...DEFAULT_PROPS} isDragging={true} />,
};
