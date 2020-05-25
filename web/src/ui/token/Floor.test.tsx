import React from "react";
import { render } from "@testing-library/react";
import { ContentType } from "../../types";
import { WALL_ICON } from "../icons";
import Floor from "./Floor";

describe("Floor", () => {
  it("Capitalizes text for text floors", () => {
    const { getByText } = render(
      <Floor
        contents={{ type: ContentType.Text, text: "lp" }}
        pos={{ x: 0, y: 0 }}
      />
    );

    expect(getByText("LP")).toBeVisible();
  });

  it("Provides an appropriate aria label for icon characters", () => {
    const { getByLabelText } = render(
      <Floor
        contents={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
        pos={{ x: 0, y: 0 }}
      />
    );

    expect(getByLabelText("Floor: stone wall")).toBeVisible();
  });
});
