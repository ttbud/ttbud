import React from "react";
import { render } from "@testing-library/react";
import Character from "./Character";
import { ContentType } from "../../types";
import { WALL_ICON } from "../icons";

describe("Character", () => {
  it("Capitalizes text for text characters", () => {
    const { getByText } = render(
      <Character
        isDragging={false}
        contents={{ type: ContentType.Text, text: "lp" }}
      />
    );

    expect(getByText("LP")).toBeVisible();
  });

  it("Provides an appropriate aria label for icon characters", () => {
    const { getByLabelText } = render(
      <Character
        isDragging={false}
        contents={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
      />
    );

    expect(getByLabelText("Character: stone wall")).toBeVisible();
  });
});
