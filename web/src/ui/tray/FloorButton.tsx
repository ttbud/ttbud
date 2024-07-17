import { ToggleButton } from "@material-ui/lab";
import { Blueprint } from "./CharacterTray/CharacterTray2";
import noop from "../../util/noop";
import { TokenContents, ContentType } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { assert } from "../../util/invariants";
import { ICONS_BY_ID } from "../icons";
import { CARD_SIZE } from "../../config";
import { makeStyles } from "@material-ui/core";

interface Props {
  contents: TokenContents;
  selected: boolean;
  onSelected?: () => void;
}

const useStyles = makeStyles({
  contents: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
});

const FloorButton: React.FC<Props> = ({ contents, selected, onSelected }) => {
  const classes = useStyles();

  const renderButtonContents = (contents: TokenContents) => {
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
  return (
    <ToggleButton
      selected={selected}
      onChange={onSelected}
      onContextMenu={noop}
      value={contents}
    >
      {renderButtonContents(contents)}
    </ToggleButton>
  );
};

export default FloorButton;
