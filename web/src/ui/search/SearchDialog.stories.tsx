import SearchDialog from "./SearchDialog";
import { ICONS } from "../icons";
import React from "react";
import { DroppableMonitor } from "../../drag/DroppableMonitor";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import noop from "../../util/noop";

export default {
  component: SearchDialog,
  title: "SearchDialog"
};

const monitor = new DroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer
  },
  middleware: getDefaultMiddleware({
    thunk: {
      extraArgument: monitor
    }
  })
});

export const Default: React.FC = () => (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <SearchDialog icons={ICONS} open={true} onClose={noop} />
    </DndContext.Provider>
  </Provider>
);
