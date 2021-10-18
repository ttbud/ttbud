import { render } from "@testing-library/react";
import { PureSettings } from "./Settings";
import noop from "../../util/noop";
import userEvent from "@testing-library/user-event";
import TtbudTheme from "../TtbudTheme";

const DEFAULT_PROPS = {
  showTourPrompt: false,
  tutorialPrompt: false,
  onTutorialDismissed: noop,
  onClearMap: noop,
  onTourClicked: noop,
  onTourPromptDismissed: noop,
};

describe("Settings", () => {
  it("opens the settings menu when the fab is clicked", () => {
    const { getByText, getByLabelText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} />
      </TtbudTheme>
    );

    getByLabelText("Settings").click();
    expect(getByText("about")).toBeVisible();
  });

  it("calls onClearMap when the clear action is confirmed", () => {
    const onClearMap = jest.fn();

    const { getByLabelText, getByText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} onClearMap={onClearMap} />
      </TtbudTheme>
    );

    getByLabelText("Settings").click();
    getByText("Clear Board").click();
    getByText("Clear").click();

    expect(onClearMap).toBeCalledTimes(1);
  });

  it("does not call onClearMap when the clear action is cancelled", () => {
    const onClearMap = jest.fn();

    const { getByLabelText, getByText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} onClearMap={onClearMap} />
      </TtbudTheme>
    );

    getByLabelText("Settings").click();
    getByText("Clear Board").click();
    getByText("Cancel").click();

    expect(onClearMap).not.toBeCalled();
  });

  it("copies url to clipboard", async () => {
    const { getByLabelText, getByText, findByText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} />
      </TtbudTheme>
    );

    const clipboardWriteFn = jest.fn();

    // jsdom doesn't support navigator.clipboard
    // @ts-ignore
    // noinspection JSConstantReassignment
    window.navigator.clipboard = {
      writeText: clipboardWriteFn,
    };

    getByLabelText("Settings").click();
    getByText("Invite Players").click();
    expect(clipboardWriteFn).toBeCalledWith(window.location.href);
    expect(await findByText("URL copied to clipboard")).toBeVisible();
  });

  it("shows tour prompt when enabled", async () => {
    const { getByText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} showTourPrompt={true} />
      </TtbudTheme>
    );

    expect(getByText("Click here for a tour")).toBeVisible();
  });

  it("calls onTourPromptDismissed when prompt close button is clicked", async () => {
    const onTourPromptDismissed = jest.fn();
    const { getByLabelText } = render(
      <TtbudTheme>
        <PureSettings
          {...DEFAULT_PROPS}
          showTourPrompt={true}
          onTourPromptDismissed={onTourPromptDismissed}
        />
      </TtbudTheme>
    );

    userEvent.click(getByLabelText("dismiss"));
    expect(onTourPromptDismissed).toBeCalled();
  });

  it("dismisses tour prompt when settings are opened", async () => {
    const onTourPromptDismissed = jest.fn();
    const { getByLabelText } = render(
      <TtbudTheme>
        <PureSettings
          {...DEFAULT_PROPS}
          showTourPrompt={true}
          onTourPromptDismissed={onTourPromptDismissed}
        />
      </TtbudTheme>
    );

    userEvent.click(getByLabelText("Settings"));
    expect(onTourPromptDismissed).toBeCalled();
  });

  it("dismisses settings when start tour is clicked", async () => {
    const onTourClicked = jest.fn();

    const { getByLabelText, getByText, queryByText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} onTourClicked={onTourClicked} />
      </TtbudTheme>
    );

    userEvent.click(getByLabelText("Settings"));
    userEvent.click(getByText("Start Tour"));

    expect(onTourClicked).toBeCalledTimes(1);
    expect(queryByText("Start Tour")).not.toBeVisible();
  });

  it("shows the about dialog when clicked", () => {
    const { getByText, getByLabelText } = render(
      <TtbudTheme>
        <PureSettings {...DEFAULT_PROPS} />
      </TtbudTheme>
    );

    userEvent.click(getByLabelText("Settings"));
    userEvent.click(getByText("about"));
    expect(getByText("Your virtual table friend")).toBeVisible();
  });
});
