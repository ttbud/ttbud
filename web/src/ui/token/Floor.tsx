import Pos2d from "../../util/shape-math";
import { ContentType, GridType, TokenContents } from "../../types";
import FloorIcon from "./FloorIcon";
import FloorText from "./FloorText";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { ICONS_BY_ID } from "../icons";

interface Props {
  contents: TokenContents;
  pos: Pos2d;
  gridType?: GridType;
}

const Floor: React.FC<Props> = ({
  contents,
  pos,
  gridType = GridType.Square,
}) => {
  switch (contents.type) {
    case ContentType.Icon:
      const icon = ICONS_BY_ID.get(contents.iconId);
      if (icon) {
        return <FloorIcon icon={icon} pos={pos} gridType={gridType} />;
      } else {
        console.warn(`Invalid icon id ${contents.iconId}`);
        return <FloorText text={"?"} pos={pos} gridType={gridType} />;
      }
    case ContentType.Text:
      return <FloorText text={contents.text} pos={pos} gridType={gridType} />;
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(contents);
  }
};

export default Floor;
