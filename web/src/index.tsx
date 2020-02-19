import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import * as serviceWorker from "./serviceWorker";
import { DomDroppableMonitor } from "./drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "./drag/DndContext";
import createStore from "./state/createStore";
import {BoardStateApiClient, EventType} from "./network/BoardStateApiClient";
import {
  addPing,
  CreateToken,
  DeleteToken,
  MoveToken,
  recordUpdatesSent, replaceTokens
} from "./state/board-slice";
import throttle from "./util/throttle";
import UnreachableCaseError from "./util/UnreachableCaseError";

const monitor = new DomDroppableMonitor();
const store = createStore(monitor);
const apiClient = new BoardStateApiClient(
  `wss://${process.env.REACT_APP_DOMAIN}:${process.env.REACT_APP_API_WEBSOCKET_PORT}`,
  url => new WebSocket(url)
);

type TokenUpdate = CreateToken | MoveToken | DeleteToken;

const NETWORK_UPDATE_RATE_MS = 3;

apiClient.connect("ff461aa1-d7e4-4f4e-a8dc-caae57bfa502");
apiClient.setEventHandler(event => {
  switch (event.type) {
    case EventType.TOKEN_UPDATE:
      store.dispatch(replaceTokens(event.tokens));
      break;
    case EventType.PING:
      store.dispatch(addPing(event.ping));
      break;
  }
});

store.subscribe(
  throttle(() => {
    const state = store.getState();
    const updates = state.board.pendingNetworkUpdates;

    if (updates.length === 0) {
      return;
    }

    for (const update of updates) {
      switch (update.type) {
        case "create":
        case "move":
          apiClient.upsert(update.token);
          break;
        case "delete":
          apiClient.delete(update.tokenId);
          break;
        case "ping":
          apiClient.ping(update.ping);
          break;
        default:
          throw new UnreachableCaseError(update);
      }
    }

    const updateIds = updates.map(update => update.updateId);
    store.dispatch(recordUpdatesSent(updateIds));
  }, NETWORK_UPDATE_RATE_MS)
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
