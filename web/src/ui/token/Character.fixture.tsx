import React from "react";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import Character from "./Character";
import { ContentType, IconContents } from "../../types";

const ICON = DEFAULT_CHARACTER_ICONS[0];
const DEFAULT_PROPS = {
  contents: { type: ContentType.Icon, iconId: ICON.id } as IconContents,
  isDragging: false,
  expandable: true,
};

export default {
  Icon: <Character {...DEFAULT_PROPS}
    contents={{ type: ContentType.Icon, iconId: ICON.id }}
  />,
  Text: (
    <Character
      {...DEFAULT_PROPS}
      contents={{ type: ContentType.Text, text: "LP" }}
    />
  ),
  Color: (
    <Character {...DEFAULT_PROPS} color={{ red: 255, green: 0, blue: 0 }} />
  ),
};
