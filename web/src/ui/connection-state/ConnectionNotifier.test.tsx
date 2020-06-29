import { render } from "@testing-library/react";
import { ConnectionStateType } from "./connection-state-slice";
import React from "react";
import { PureConnectionNotifier } from "./ConnectionNotifier";
import "@testing-library/jest-dom";
import noop from "../../util/noop";
import { ConnectionError } from "../../network/BoardStateApiClient";

describe("ConnectionNotifier", () => {
  it("says connecting when state is connecting", () => {
    const { getByText } = render(
      <PureConnectionNotifier
        connectionState={{ type: ConnectionStateType.Connecting }}
        onReconnectClick={noop}
      />
    );

    expect(getByText(/Connecting/)).toBeVisible();
  });

  it("says disconnected when state is disconnected", () => {
    const { getByText } = render(
      <PureConnectionNotifier
        connectionState={{
          type: ConnectionStateType.Disconnected,
          error: ConnectionError.UNKNOWN,
        }}
        onReconnectClick={noop}
      />
    );

    expect(getByText(/Disconnected/)).toBeVisible();
  });

  it("triggers the reconnect listener when the reconnect button is clicked", async () => {
    const onReconnectClick = jest.fn();
    const { findByLabelText } = render(
      <PureConnectionNotifier
        connectionState={{
          type: ConnectionStateType.Disconnected,
          error: ConnectionError.UNKNOWN,
        }}
        onReconnectClick={onReconnectClick}
      />
    );

    (await findByLabelText("reconnect")).click();
    expect(onReconnectClick).toHaveBeenCalled();
  });
});
