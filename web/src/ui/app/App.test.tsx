import ReactDOM from "react-dom";
import App from "./App";
import createStore from "../../store/createStore";
import { Provider } from "react-redux";
import FakeApiClient from "../../network/__test_util__/FakeApiClient";
import TtbudTheme from "../TtbudTheme";

jest.mock("../../network/BoardStateApiClient");

it("renders without crashing", () => {
  const apiClient = new FakeApiClient();
  const store = createStore(apiClient);

  const div = document.createElement("div");

  ReactDOM.render(
    <Provider store={store}>
      <TtbudTheme>
        <App apiClient={apiClient} />
      </TtbudTheme>
    </Provider>,
    div
  );

  ReactDOM.unmountComponentAtNode(div);
});
