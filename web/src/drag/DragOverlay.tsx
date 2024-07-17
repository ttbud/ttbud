import Character2 from "../ui/token/Character2/Character2";
import FloorButton from "../ui/tray/FloorButton";
import { TokenDescriptor } from "./Draggable2";
import { DragOverlay as DndKitDragOverlay } from "@dnd-kit/core";

interface OverlayProps {
  activeDragDescriptor: TokenDescriptor | undefined;
}

const DragOverlayContents: React.FC<OverlayProps> = ({
  activeDragDescriptor,
}) => {
  if (activeDragDescriptor === undefined) return null;

  console.log("dragoverlay", { activeDragDescriptor });
  //TODO: activeDragDescriptor is only loaded on start, which means the origin never changes
  if (activeDragDescriptor.origin.containerId === "floor-tray") {
    return (
      <FloorButton contents={activeDragDescriptor.contents} selected={true} />
    );
  } else {
    return <Character2 contents={activeDragDescriptor.contents} />;
  }
};

const DragOverlay: React.FC<OverlayProps> = (props) => {
  return (
    <DndKitDragOverlay>
      <DragOverlayContents {...props} />
    </DndKitDragOverlay>
  );
};

export default DragOverlay;
