import SearchDialog from "./SearchDialog";
import { ICONS } from "../icons";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import noop from "../../util/noop";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer,
  },
  middleware: getDefaultMiddleware({
    thunk: {
      extraArgument: { monitor },
    },
  }),
});

export default (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <SearchDialog icons={ICONS} open={true} onClose={noop} />
    </DndContext.Provider>
  </Provider>
);
