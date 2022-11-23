import React from "react";
import { contentId, ContentType, TokenContents } from "../../types";
import ToggleButton from "@mui/material/ToggleButton";
import { ICONS_BY_ID } from "../icons";
import { assert } from "../../util/invariants";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import makeStyles from "@mui/styles/makeStyles";
import { CARD_SIZE } from "../../config";

const useContentStyles = makeStyles({
  contents: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
});

interface ContentProps {
  contents: TokenContents;
}

const ButtonContents: React.FC<ContentProps> = ({ contents }) => {
  const classes = useContentStyles();

  switch (contents.type) {
    case ContentType.Icon:
      const icon = ICONS_BY_ID.get(contents.iconId);
      assert(icon, `Icon id ${contents.iconId} is invalid`);
      return (
        <img
          aria-label={`Floor: ${icon.desc}`}
          src={icon.img}
          className={classes.contents}
          alt={icon.img}
          draggable={false}
        />
      );
    case ContentType.Text:
      return (
        <div
          aria-label={`Floor: ${contents.text}`}
          className={classes.contents}
        >
          {contents.text}
        </div>
      );
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(contents);
  }
};

interface Props {
  selected: boolean;
  content: TokenContents;
  grabbing?: boolean;
  onFloorSelected?: () => void;
  onDelete?: () => void;
}

const FloorButton: React.FC<Props> = ({
  content,
  selected,
  grabbing,
  onFloorSelected,
  onDelete,
}) => {
  return (
    <ToggleButton
      value={content}
      key={contentId(content)}
      selected={selected}
      onChange={onFloorSelected}
      onClick={() => console.log("clicked")}
      onContextMenu={onDelete}
      style={grabbing ? { cursor: "grabbing" } : {}}
    >
      <ButtonContents contents={content} />
    </ToggleButton>
  );
};

export default FloorButton;
