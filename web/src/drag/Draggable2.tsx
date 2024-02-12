import { useDraggable } from "@dnd-kit/core";
import { TokenContents } from "../types";
import { LogicalLocation } from "./DragStateTypes";
import { CSSProperties } from "@material-ui/core/styles/withStyles";

export interface TokenOrigin {
  containerId: string;
  location: LogicalLocation;
}

export interface TokenDescriptor {
  contents: TokenContents;
  origin: TokenOrigin;
  networkId?: string;
}

interface Props {
  id: string;
  descriptor: TokenDescriptor;
  style?: CSSProperties;
}

const Draggable2: React.FC<Props> = ({ id, descriptor, style, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: descriptor,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ visibility: isDragging ? "hidden" : "visible", ...style }}
    >
      {children}
    </div>
  );
};

export default Draggable2;
