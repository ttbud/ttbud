import React from "react";
import App from "./App";
import noBorder from "../__stories__/no-border";
import { DroppableMonitor } from "../drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "../drag/DndContext";
import { createStore } from "../../state/store";

export default {
  component: App,
  title: "App",
  decorators: [noBorder]
};

const monitor = new DroppableMonitor();
const store = createStore(monitor);

export const Default = () => {
  return (
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <App />
      </DndContext.Provider>
    </Provider>
  );
};
