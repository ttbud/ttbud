import { DEFAULT_CHARACTER_ICONS } from "../../icons";
import { ContentType, IconContents } from "../../../types";
import React from "react";
import ExpandableCharacter from "./ExpandableCharacter";

const ICON = DEFAULT_CHARACTER_ICONS[0];
const DEFAULT_PROPS = {
  id: "character-id",
  contents: { type: ContentType.Icon, iconId: ICON.id } as IconContents,
};

const ExpandableCharacterFixture: React.FC = () => {
  return <ExpandableCharacter {...DEFAULT_PROPS} />;
};

export default ExpandableCharacterFixture;
