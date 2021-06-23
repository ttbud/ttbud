import { findByText, getByText, render } from "@testing-library/react";
import Tour from "./Tour";
import noop from "../../util/noop";

const DEFAULT_PROPS = {
  isOpen: true,
  onCloseClicked: noop,
};

it("Shows each step of the tour", async () => {
  const { container, findByText, queryByRole, getByRole } = render(
    <>
      <Tour {...DEFAULT_PROPS} />
      <div data-tour="character-tray" />
      <div data-tour="floor-tray" />
      <div data-tour="settings" />
    </>
  );
  const tourSteps = [
    "Character Tray",
    "Environment Tray",
    "More Icons",
    "Commands",
    "Menu",
  ];

  for (const step of tourSteps) {
    expect(await findByText(step)).toBeVisible();
    const next = queryByRole("button", { name: "Next" });
    next?.click();
  }

  // Click done and the tour goes away
  const done = getByRole("button", { name: "Done" });
  done.click();
  expect(container).not.toHaveTextContent(/.+/);
});
