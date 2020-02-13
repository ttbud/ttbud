import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { DomDroppableMonitor } from "../drag/DroppableMonitor";
import createStore from "../../state/createStore";
import { Provider } from "react-redux";
import DndContext from "../drag/DndContext";

it("renders without crashing", () => {
  const monitor = new DomDroppableMonitor();
  const store = createStore(monitor);

  const div = document.createElement("div");

  ReactDOM.render(
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <App />
      </DndContext.Provider>
    </Provider>,
    div
  );

  ReactDOM.unmountComponentAtNode(div);
});
