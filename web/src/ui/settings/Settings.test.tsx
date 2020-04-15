import { render } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom/extend-expect";
import Settings from "./Settings";
import noop from "../../util/noop";

describe("Settings", () => {
  it("opens the settings menu when the fab is clicked", () => {
    const { getByText, getByLabelText } = render(
      <Settings debugEnabled={false} onDebugToggled={noop} onClearMap={noop} />
    );

    getByLabelText("Settings").click();
    expect(getByText("Settings")).toBeVisible();
  });

  it("shows the debug toggle switched to off when debugEnabled is false", () => {
    const { getByLabelText, getByRole } = render(
      <Settings debugEnabled={false} onDebugToggled={noop} onClearMap={noop} />
    );

    getByLabelText("Settings").click();
    expect(
      getByRole("checkbox", { name: "Enable Debug Logs" })
    ).not.toBeChecked();
  });

  it("shows the debug toggle switched to on when debugEnabled is true", () => {
    const { getByLabelText, getByRole } = render(
      <Settings debugEnabled={true} onDebugToggled={noop} onClearMap={noop} />
    );

    getByLabelText("Settings").click();
    expect(getByRole("checkbox", { name: "Enable Debug Logs" })).toBeChecked();
  });

  it("calls onDebugToggled when the debug switch is clicked", () => {
    const onDebugToggled = jest.fn();

    const { getByLabelText, getByRole } = render(
      <Settings
        debugEnabled={true}
        onDebugToggled={onDebugToggled}
        onClearMap={noop}
      />
    );

    getByLabelText("Settings").click();
    getByRole("checkbox", { name: "Enable Debug Logs" }).click();

    expect(onDebugToggled).toBeCalledTimes(1);
  });

  it("calls onClearMap when the clear action is confirmed", () => {
    const onClearMap = jest.fn();

    const { getByLabelText, getByText } = render(
      <Settings
        debugEnabled={true}
        onDebugToggled={noop}
        onClearMap={onClearMap}
      />
    );

    getByLabelText("Settings").click();
    getByText("Clear Map").click();
    getByText("Clear").click();

    expect(onClearMap).toBeCalledTimes(1);
  });

  it("does not call onClearMap when the clear action is cancelled", () => {
    const onClearMap = jest.fn();

    const { getByLabelText, getByText } = render(
      <Settings
        debugEnabled={true}
        onDebugToggled={noop}
        onClearMap={onClearMap}
      />
    );

    getByLabelText("Settings").click();
    getByText("Clear Map").click();
    getByText("Cancel").click();

    expect(onClearMap).not.toBeCalled();
  });
});
