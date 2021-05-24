import React from "react";
import { DomDroppableMonitor } from "./DroppableMonitor";

const DndContext =
  React.createContext<DomDroppableMonitor | undefined>(undefined);

export default DndContext;
