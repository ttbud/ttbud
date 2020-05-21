import React from "react";
import Pos2d from "../../util/shape-math";
import { ContentType, TokenContents } from "../../types";
import FloorIcon from "./FloorIcon";
import FloorText from "./FloorText";
import UnreachableCaseError from "../../util/UnreachableCaseError";

interface Props {
  contents: TokenContents;
  pos: Pos2d;
}

const Floor: React.FC<Props> = ({ contents, pos }) => {
  switch (contents.type) {
    case ContentType.Icon:
      return <FloorIcon iconId={contents.iconId} pos={pos} />;
    case ContentType.Text:
      return <FloorText text={contents.text} pos={pos} />;
    default:
      throw new UnreachableCaseError(contents);
  }
};

export default Floor;
