import { render } from "@testing-library/react";
import { ConnectionState } from "./connection-state-slice";
import React from "react";
import { PureConnectionNotifier } from "./ConnectionNotifier";
import "@testing-library/jest-dom";

describe("ConnectionNotifier", () => {
  it("says connecting when state is connecting", () => {
    const { getByText } = render(
      <PureConnectionNotifier connectionState={ConnectionState.Connecting} />
    );

    expect(getByText("Connecting")).toBeVisible();
  });

  it("says disconnected when state is disconnected", () => {
    const { getByText } = render(
      <PureConnectionNotifier connectionState={ConnectionState.Disconnected} />
    );

    expect(getByText("Disconnected")).toBeVisible();
  });
});
