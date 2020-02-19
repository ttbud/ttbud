import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import * as serviceWorker from "./serviceWorker";
import { DomDroppableMonitor } from "./drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "./drag/DndContext";
import createStore from "./state/createStore";
import { BoardStateApiClient, EventType } from "./network/BoardStateApiClient";
import { addPing, replaceTokens } from "./state/board-slice";
import {
  getNetworkUpdates,
  getNewLocalState,
  Update
} from "./network/board-state-diff";
import { Token } from "./network/TokenStateClient";
import uuid from "uuid";

const monitor = new DomDroppableMonitor();
const store = createStore(monitor);
const apiClient = new BoardStateApiClient(
  `wss://${process.env.REACT_APP_DOMAIN}:${process.env.REACT_APP_API_WEBSOCKET_PORT}`,
  url => new WebSocket(url)
);

let unackedUpdates = new Map<string, Update[]>();
let networkTokens: Token[] = [];

apiClient.connect("ff461aa1-d7e4-4f4e-a8dc-caae57bfa549");
apiClient.setEventHandler(event => {
  switch (event.type) {
    case EventType.TOKEN_UPDATE:
      unackedUpdates.delete(event.requestId);
      networkTokens = event.tokens;
      const newLocalState = getNewLocalState(
        networkTokens,
        Array.from(unackedUpdates.values()).flat()
      );

      console.log({
        networkTokens,
        unackedUpdates: Array.from(unackedUpdates.values()).flat(),
        newLocalState,
      });
      store.dispatch(replaceTokens(newLocalState));
      break;
    case EventType.PING:
      unackedUpdates.delete(event.requestId);
      store.dispatch(addPing(event.ping));
      break;
  }
});

store.subscribe(
  () => {
    const state = store.getState();
    const diffState = {
      networkTokens,
      uiTokens: state.board.tokens,
      unackedUpdates: Array.from(unackedUpdates.values()).flat()
    };
    const updates = getNetworkUpdates(diffState);

    if (updates.length === 0) {
      return;
    }

    const requestId = uuid();
    apiClient.send(requestId, updates);
    unackedUpdates.set(requestId, updates);
  }
);

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
