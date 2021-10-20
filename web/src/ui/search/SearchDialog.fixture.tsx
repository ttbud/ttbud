import SearchDialog from "./SearchDialog";
import { ICONS } from "../icons";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import noop from "../../util/noop";
import TtbudTheme from "../TtbudTheme";

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
      <TtbudTheme>
        <div style={{ position: "fixed", right: 0, height: "100vh" }}>
          <SearchDialog icons={ICONS} open={true} onClose={noop} />
        </div>
      </TtbudTheme>
    </DndContext.Provider>
  </Provider>
);
