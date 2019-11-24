import React, {MouseEventHandler, useEffect, useState} from "react";

interface Pos {
  x: number;
  y: number;
}

interface Props {
  pos?: Pos;
  startWithDragAt?: Pos;
  onDragStart?: (e: MouseEvent) => void;
  onDragStop?: (pos: Pos) => void;
}

const Draggable: React.FC<Props> = ({
  children,
  startWithDragAt,
  pos = { x: 0, y: 0 },
  onDragStart = () => {},
  onDragStop = () => {}
}) => {
  const defaultPos = pos;

  const [isDragging, setDragging] = useState(!!startWithDragAt);
  const [dragStart, setDragStart] = useState(startWithDragAt || {x: 0, y: 0});
  const [offset, setOffset] = useState(defaultPos);

  const onMouseDown: MouseEventHandler = e => {
    if (e.button !== 0) {
      return;
    }

    onDragStart(e.nativeEvent);

    setDragStart({ x: e.clientX, y: e.clientY });
    setOffset(defaultPos);
    setDragging(true);
    e.stopPropagation();
  };

  useEffect(() => {
    const onMouseUp = ({ clientX, clientY }: MouseEvent) => {
      if (!isDragging) {
        return;
      }

      setDragging(false);
      setDragStart({ x: 0, y: 0 });
      setOffset({ x: 0, y: 0 });

      onDragStop({
        x: clientX,
        y: clientY
      });
    };

    const onMouseMove = ({ clientX, clientY }: MouseEvent) => {
      if (!isDragging) {
        return;
      }

      setOffset({
        x: clientX - dragStart.x + defaultPos.x,
        y: clientY - dragStart.y + defaultPos.y
      });
    };

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [defaultPos, dragStart, isDragging, onDragStop]);

  const translate = isDragging ? offset : defaultPos;
  const style = { transform: `translate(${translate.x}px, ${translate.y}px)` };

  return (
    <div onMouseDown={onMouseDown} style={style}>
      {children}
    </div>
  );
};

export default Draggable;
