import React from "react";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import Character from "./Character";

const ICON = DEFAULT_CHARACTER_ICONS[0];
const DEFAULT_PROPS = {
  icon: ICON,
  style: { width: 40, height: 40 },
  isDragging: false,
};

export default {
  Default: <Character {...DEFAULT_PROPS} />,
  Dragging: <Character {...DEFAULT_PROPS} isDragging={true} />,
};
