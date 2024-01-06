import { render } from "@testing-library/react";
import SearchTray from "./SearchTray";
import noop from "../../util/noop";
import { DEFAULT_FLOOR_ICONS, WALL_ICON } from "../icons";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { FakeDroppableMonitor } from "../../drag/__test_util__/FakeDroppableMonitor";
import DndContext from "../../drag/DndContext";
import {
  DraggableType,
  DragState,
  DragStateType,
} from "../../drag/DragStateTypes";
import { ContentType } from "../../types";
import { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";

const DEFAULT_PROPS = {
  icons: DEFAULT_FLOOR_ICONS,
  onSearchClicked: noop,
  open: true,
};

interface RenderProps {
  state?: DragState;
  props?: Partial<ComponentProps<typeof SearchTray>>;
}

function renderSearchDialog({
  state = { type: DragStateType.NotDragging },
  props = {},
}: RenderProps = {}) {
  const monitor = new FakeDroppableMonitor();
  const store = configureStore({
    reducer: { drag: dragReducer },
    preloadedState: { drag: state },
  });

  return render(
    <Provider store={store}>
      <DndContext.Provider value={monitor as unknown as DomDroppableMonitor}>
          <SearchTray {...DEFAULT_PROPS} {...props} />
      </DndContext.Provider>
    </Provider>
  );
}

describe("SearchTray", () => {
  it("shows all icons by default", () => {
    const { getByLabelText } = renderSearchDialog();

    for (const icon of DEFAULT_PROPS.icons) {
      expect(getByLabelText(`Character: ${icon.desc}`)).toBeVisible();
    }
  });

  it("shows capitalized text icons for two letter searches", () => {
    const { getByText, getByLabelText } = renderSearchDialog();

    const searchBar = getByLabelText("search");
    userEvent.type(searchBar, "ab");
    expect(getByText("AB")).toBeVisible();
  });

  it("shows capitalized text icons for one letter searches", () => {
    const { getByText, getByLabelText } = renderSearchDialog();

    const searchBar = getByLabelText("search");
    userEvent.type(searchBar, "z");
    expect(getByText("Z")).toBeVisible();
  });

  it("only shows icons that match the search", () => {
    const { queryByLabelText, getByLabelText } = renderSearchDialog();
    const searchBar = getByLabelText("search");
    userEvent.type(searchBar, "stone");
    expect(getByLabelText("Character: stone wall")).toBeVisible();
    expect(queryByLabelText("Character: bed")).not.toBeInTheDocument();
  });
});
