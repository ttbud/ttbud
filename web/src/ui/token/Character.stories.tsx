import React from "react";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import Character from "./Character";

export default {
  component: Character,
  title: "Character",
};

const ICON = DEFAULT_CHARACTER_ICONS[0];
const DEFAULT_PROPS = {
  icon: ICON,
  style: { width: 40, height: 40 },
  isDragging: false,
};

export const Default = () => <Character {...DEFAULT_PROPS} />;
export const Dragging = () => (
  <Character {...DEFAULT_PROPS} isDragging={true} />
);
