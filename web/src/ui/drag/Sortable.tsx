import React, { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragDescriptor } from "./types";

interface Props {
  id: string;
  data: DragDescriptor;
}

const Sortable: React.FC<Props> = ({ id, data, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data });

  const style: CSSProperties = {
    cursor: "pointer",
    transform: CSS.Transform.toString(transform),
    transition,
    visibility: isDragging ? "hidden" : "visible",
  };

  return (
    <div style={style} ref={setNodeRef} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export default Sortable;
