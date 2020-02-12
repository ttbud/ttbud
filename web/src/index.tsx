import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import * as serviceWorker from "./serviceWorker";
import { DroppableMonitor } from "./ui/drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "./ui/drag/DndContext";
import createStore from "./state/createStore";
import { BoardStateApiClient } from "./network/BoardStateApiClient";

const apiHost = process.env.REACT_APP_DOMAIN;
const apiPort = process.env.REACT_APP_API_WEBSOCKET_PORT;
const monitor = new DroppableMonitor();
const apiClient = new BoardStateApiClient(
  `wss://${apiHost}:${apiPort}`,
  url => new WebSocket(url)
);
const store = createStore(monitor, apiClient);

const render = () => {
  const App = require("./ui/app/App").default;

  ReactDOM.render(
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <App />
      </DndContext.Provider>
    </Provider>,
    document.getElementById("root")
  );
};

render();

if (process.env.NODE_ENV === "development" && module.hot) {
  module.hot.accept("./ui/app/App", render);
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
