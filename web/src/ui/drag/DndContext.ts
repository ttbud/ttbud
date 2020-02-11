import React from "react";
import { DroppableMonitor } from "./DroppableMonitor";

const DndContext = React.createContext<DroppableMonitor | undefined>(undefined);

export default DndContext;
