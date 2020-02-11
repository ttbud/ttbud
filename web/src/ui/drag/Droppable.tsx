import React, {
  ReactElement,
  RefObject,
  useContext,
  useEffect,
  useRef
} from "react";
import DndContext from "./DndContext";
import { fail } from "../../util/invariant";
import { LocationCollector } from "./DroppableMonitor";
import noop from "../../util/noop";

export interface DroppableAttributes {
  ref: RefObject<any>;
}

interface Props {
  id: string;
  onBeforeDragStart?: () => void;
  getLocation: LocationCollector;
  children: (attributes: DroppableAttributes) => ReactElement;
}

const Droppable: React.FC<Props> = ({
  id,
  onBeforeDragStart = noop,
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
      onBeforeDragStart
    });

    return () => dndContext.removeDroppable(id);
  }, [dndContext, getLocation, id, onBeforeDragStart]);

  return children({ ref });
};

export default Droppable;
