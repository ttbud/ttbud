import React, {
  MutableRefObject,
  ReactElement,
  useContext,
  useEffect,
  useRef
} from "react";
import { fail } from "../util/invariants";
import noop from "../util/noop";
import { Bounds } from "../util/shape-math";
import DndContext from "./DndContext";
import { DraggableDescriptor } from "./DragStateTypes";
import { LocationCollector } from "./DroppableMonitor";

export interface DroppableAttributes {
  ref: MutableRefObject<any>;
}

interface Props {
  id: string;
  onBeforeDragStart?: (draggable: DraggableDescriptor, bounds: Bounds) => void;
  getLocation: LocationCollector;
  getDragBounds?: () => Bounds | undefined;
  children: (attributes: DroppableAttributes) => ReactElement;
}

const noBounds = () => undefined;

const Droppable: React.FC<Props> = ({
  id,
  onBeforeDragStart = noop,
  getDragBounds = noBounds,
  getLocation,
  children
}) => {
  const dndContext = useContext(DndContext) ?? fail("No DndContext found");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    dndContext.addDroppable({
      id,
      ref,
      getLocation,
      onBeforeDragStart,
      getDragBounds
    });

    return () => dndContext.removeDroppable(id);
  }, [dndContext, getDragBounds, getLocation, id, onBeforeDragStart]);

  return children({ ref });
};

export default Droppable;
