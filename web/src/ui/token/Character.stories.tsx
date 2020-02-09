import React from "react";
import Character from "./Character";
import { ICONS, IconType } from "../icons";

export default {
  component: Character,
  title: "Character"
};

const ICON = ICONS.filter(icon => icon.type === IconType.token)
  .take(1)
  .get(0)!;

const DEFAULT_PROPS = {
  icon: ICON,
  style: { width: 40, height: 40 },
  isDragging: false
};

export const Default = () => <Character {...DEFAULT_PROPS} />;
export const Dragging = () => (
  <Character {...DEFAULT_PROPS} isDragging={true} />
);
