import Board2 from "./Board2";
import { WALL_ICON } from "../icons";
import { ContentType, EntityType } from "../../types";
import noop from "../../util/noop";
import { BoardState, toPosStr } from "./board-state";
import { contentId } from "../../types";

const WALL_CONTENTS = { iconId: WALL_ICON.id, type: ContentType.Icon } as const;

const boardState: BoardState = {
  charIdsByContentId: {
    [contentId(WALL_CONTENTS)]: ["wall-id"],
  },
  entityById: {
    "wall-id": {
      contents: WALL_CONTENTS,
      id: "wall-id",
      pos: { x: 5, y: 5, z: 1 },
      type: EntityType.Character,
    },
  },
  tokenIdsByPosStr: {
    [toPosStr({ x: 5, y: 5, z: 1 })]: "wall-id",
  },
};

const Board2Fixture: React.FC = () => {
  return (
    // Negative margin to cancel out the body margin because board cannot handle that :(
    <div style={{ width: "100vw", height: "100vh", margin: "-8px" }}>
      <Board2
        activeFloor={WALL_CONTENTS}
        isDragging={false}
        onFloorCreated={noop}
        onPingCreated={noop}
        onTokenDeleted={noop}
        boardState={boardState}
      />
    </div>
  );
};

export default Board2Fixture;
