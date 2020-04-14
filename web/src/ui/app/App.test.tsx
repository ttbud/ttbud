import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import createStore from "../../store/createStore";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import { BoardStateApiClient } from "../../network/BoardStateApiClient";

it("renders without crashing", () => {
  const monitor = new DomDroppableMonitor();
  const apiClient = new BoardStateApiClient("invalid", () => {
    throw new Error("No connecting to servers in tests");
  });
  const store = createStore(monitor, apiClient);

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
