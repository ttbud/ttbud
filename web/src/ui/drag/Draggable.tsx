import React, { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { DragDescriptor } from "./types";

interface Props {
  /**
   * Globally unique id for the draggable
   */
  id: string;
  /**
   * Identifying data for the draggable
   */
  descriptor: DragDescriptor;
}

const Draggable: React.FC<Props> = ({ id, descriptor, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: descriptor,
  });

  // We intentionally don't use the transform from useDraggable here because we render the visible draggable in the drag
  // overlay
  const style: CSSProperties = {
    cursor: "pointer",
    display: "inline-block",
    visibility: isDragging ? "hidden" : "visible",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
};

export default Draggable;
