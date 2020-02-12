import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { DroppableMonitor } from "../drag/DroppableMonitor";
import createStore from "../../state/createStore";
import { Provider } from "react-redux";
import DndContext from "../drag/DndContext";
import { BoardStateApiClient } from "../../network/BoardStateApiClient";

it("renders without crashing", () => {
  const monitor = new DroppableMonitor();
  const apiClient = new BoardStateApiClient("invalid", addr => {
    return new WebSocket(addr);
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
