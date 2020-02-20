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
  getLocalState,
  getNetworkUpdates,
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

apiClient.setEventHandler(event => {
  switch (event.type) {
    case EventType.INITIAL_STATE:
      networkTokens = event.tokens;
      store.dispatch(replaceTokens(event.tokens));
      break;
    case EventType.TOKEN_UPDATE:
      networkTokens = event.tokens;
      unackedUpdates.delete(event.requestId);
      const localState = getLocalState(
        event.tokens,
        Array.from(unackedUpdates.values()).flat()
      );

      store.dispatch(replaceTokens(localState));
      break;
    case EventType.PING:
      unackedUpdates.delete(event.requestId);
      store.dispatch(addPing(event.ping));
      break;
    case EventType.ERROR:
      if (event.requestId) {
        unackedUpdates.delete(event.requestId);
      }
      console.log(event);
      console.error(event.error);
      break;
  }
});

store.subscribe(() => {
  const state = store.getState();
  const updates = getNetworkUpdates({
    networkTokens,
    uiTokens: state.board.tokens,
    unackedUpdates: Array.from(unackedUpdates.values()).flat()
  });

  if (updates.length === 0) {
    return;
  }

  const requestId = uuid();
  apiClient.send(requestId, updates);
  unackedUpdates.set(requestId, updates);
});

const path = window.location.pathname.split("/room/")[1];
const roomId = path ? atob(path) : uuid();
window.history.replaceState({}, "Your special room", `/room/${btoa(roomId)}`);
apiClient.connect(roomId);

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
