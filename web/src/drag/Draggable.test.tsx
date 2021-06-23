import React from "react";
import Draggable from "./Draggable";
import { ContentType } from "../types";
import { DraggableType } from "./DragStateTypes";
import { WALL_ICON } from "../ui/icons";
import { render } from "@testing-library/react";
import DndContext from "./DndContext";
import { FakeDroppableMonitor } from "./__test_util__/FakeDroppableMonitor";
import { DomDroppableMonitor } from "./DroppableMonitor";
import { Provider } from "react-redux";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "./drag-slice";
import { fireEvent } from "@testing-library/dom";
import { Buttons } from "../ui/util/Buttons";

function testDraggable() {
  const monitor = new FakeDroppableMonitor();
  const store = configureStore({
    reducer: {
      drag: dragReducer,
    },
    middleware: getDefaultMiddleware({
      thunk: { extraArgument: { monitor } },
    }),
  });

  return (
    <Provider store={store}>
      <DndContext.Provider value={monitor as unknown as DomDroppableMonitor}>
        <Draggable
          descriptor={{
            type: DraggableType.TokenBlueprint,
            id: "draggable",
            contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
          }}
        >
          {(isDragging, attributes) => (
            <div {...attributes}>{isDragging ? "dragging" : "still"}</div>
          )}
        </Draggable>
      </DndContext.Provider>
    </Provider>
  );
}

describe("Draggable", () => {
  it("sets isDragging to true while dragging", async () => {
    const { findByText, getByText } = render(testDraggable());

    fireEvent.pointerDown(getByText("still"), { buttons: Buttons.LEFT_MOUSE });
    const draggingEl = await findByText("dragging");
    expect(draggingEl).toBeVisible();
    fireEvent.pointerUp(draggingEl, { buttons: Buttons.LEFT_MOUSE });
    // Have to manually trigger transitionEnd event because jsdom doesn't support it
    fireEvent.transitionEnd(draggingEl);
    expect(await findByText("still")).toBeVisible();
  });

  it("moves the element as the mouse moves", async () => {
    const { findByText, getByText } = render(testDraggable());

    const draggable = getByText("still");
    fireEvent.pointerDown(draggable, { buttons: Buttons.LEFT_MOUSE });
    await findByText("dragging");
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });

    // jsdom doesn't actually do any layout so we have to rely on the more fragile
    // test of checking the style is set correctly instead of fetching its position
    expect(draggable.style.transform).toEqual(`translate(50px, 50px)`);
  });

  it("Ignores clicks other than left click", async () => {
    const { queryByText, getByText } = render(testDraggable());

    const draggable = getByText("still");
    fireEvent.pointerDown(draggable, { buttons: Buttons.RIGHT_MOUSE });
    expect(queryByText("dragging")).not.toBeInTheDocument();
  });

  it("Ignores clicks when modifiers are held", async () => {
    const { queryByText, getByText } = render(testDraggable());

    const draggable = getByText("still");
    fireEvent.pointerDown(draggable, {
      buttons: Buttons.LEFT_MOUSE,
      shiftKey: true,
    });
    expect(queryByText("dragging")).not.toBeInTheDocument();
  });
});
