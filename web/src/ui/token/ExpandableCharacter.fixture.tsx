import React from "react";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import { ContentType, IconContents } from "../../types";
import ExpandableCharacter, { Props } from "./ExpandableCharacter";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";

const ICON = DEFAULT_CHARACTER_ICONS[0];

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

const WrappedCharacter: React.FC<Props> = (props) => (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <ExpandableCharacter {...props} />
    </DndContext.Provider>
  </Provider>
);

export default {
  Icon: (
    <WrappedCharacter contents={{ type: ContentType.Icon, iconId: ICON.id }} />
  ),
  IconWithName: (
    <WrappedCharacter contents={{ type: ContentType.Icon, iconId: ICON.id }} />
  ),
  Text: (
    <WrappedCharacter contents={{ type: ContentType.Icon, iconId: ICON.id }} />
  ),
  TextWithName: (
    <WrappedCharacter contents={{ type: ContentType.Icon, iconId: ICON.id }} />
  ),
};
