import React, { forwardRef, HTMLAttributes, Ref } from "react";

interface Props
  extends React.PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  color: string;
}

export default forwardRef<HTMLDivElement, Props>(function Square(
  props: Props,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div
      {...props}
      ref={ref}
      style={{
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100px",
        height: "100px",
        backgroundColor: props.color,
        ...props.style
      }}
    >
      {props.children}
    </div>
  );
});
