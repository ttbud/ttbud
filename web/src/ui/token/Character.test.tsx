import { render } from "@testing-library/react";
import Character from "./Character";
import { ContentType } from "../../types";
import { WALL_ICON } from "../icons";
import { fireEvent } from "@testing-library/dom";

describe("Character", () => {
  it("Capitalizes text for text characters", () => {
    const { getByText } = render(
      <Character
        raise={false}
        contents={{ type: ContentType.Text, text: "lp" }}
      />
    );

    expect(getByText("LP")).toBeVisible();
  });

  it("Shows a question mark when the icon id is invalid", () => {
    const { getByText } = render(
      <Character
        raise={false}
        contents={{ type: ContentType.Icon, iconId: "invalid-id.svg" }}
      />
    );

    expect(getByText("?")).toBeVisible();
  });

  it("Provides an appropriate aria label for icon characters", () => {
    const { getByLabelText } = render(
      <Character
        raise={false}
        contents={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
      />
    );

    expect(getByLabelText("Character: stone wall")).toBeVisible();
  });

  it("Calls the onDelete method when right clicked", () => {
    const onDelete = jest.fn();
    const { getByText } = render(
      <Character
        raise={false}
        contents={{ type: ContentType.Text, text: "TS" }}
        onDelete={onDelete}
      />
    );

    fireEvent.contextMenu(getByText("TS"));
    expect(onDelete).toBeCalled();
  });
});
