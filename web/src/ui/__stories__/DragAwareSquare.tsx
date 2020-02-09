import React, { forwardRef, HTMLAttributes, Ref } from "react";
import Square from "./Square";

interface Props
  extends React.PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  isDragging: boolean;
  color: string;
}

export default forwardRef<HTMLDivElement, Props>(function DragAwareSquare(
  { isDragging, color, style, ...attributes }: Props,
  ref: Ref<HTMLDivElement>
) {
  return (
    <Square
      ref={ref}
      color={color}
      style={{
        zIndex: isDragging ? 1000 : "auto",
        position: isDragging ? "relative" : "static",
        ...style
      }}
      {...attributes}
    >
      {isDragging ? "weee" : "drag me"}
    </Square>
  );
});
