import React from "react";
import Character from "../token/Character";
import {
  defaultDropAnimation,
  DragOverlay,
  DropAnimation,
  useDndMonitor,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { DragDescriptor } from "./types";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import FloorButton from "../tray/FloorButton";

const modifiers = [restrictToWindowEdges];
const dropAnimation: DropAnimation = {
  ...defaultDropAnimation,
  dragSourceOpacity: 0,
};

interface TokenProps {
  activeItem: DragDescriptor;
}

const Token: React.FC<TokenProps> = ({ activeItem: { contents, type } }) => {
  switch (type) {
    case "character":
      return <Character raise={true} contents={contents} />;
    case "floor":
      return <FloorButton selected={true} grabbing={true} content={contents} />;
    default:
      throw new UnreachableCaseError(type);
  }
};

interface Props {
  activeItem?: DragDescriptor;
}

const TokenDragOverlay: React.FC<Props> = React.memo(({ activeItem }) => {
  useDndMonitor({
    onDragStart() {
      document.body.style.cursor = "grab";
    },
    onDragEnd() {
      document.body.style.cursor = "auto";
    },
    onDragCancel() {
      document.body.style.cursor = "auto";
    },
  });

  return (
    <DragOverlay
      modifiers={modifiers}
      dropAnimation={dropAnimation}
      style={{ cursor: "grabbing" }}
      adjustScale={false}
    >
      {activeItem && <Token activeItem={activeItem} />}
    </DragOverlay>
  );
});

export default TokenDragOverlay;
