import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import boardReducer, {
  addFloor,
  addPing,
  BoardState,
  removeToken,
  replaceTokens
} from "./board-slice";
import { Token, TokenType } from "../network/BoardStateApiClient";
import { dragEnded } from "../drag/drag-slice";
import { DraggableType, LocationType } from "../drag/DragStateTypes";
import { WALL_ICON } from "../ui/icons";
import { DROPPABLE_IDS } from "../ui/DroppableIds";

function createTestStore(initialState: BoardState) {
  return configureStore({
    reducer: { board: boardReducer },
    preloadedState: { board: initialState },
    middleware: getDefaultMiddleware()
  });
}

const EMPTY_BOARD: BoardState = {
  tokens: []
};

const TOKEN_1: Token = {
  id: "token-1",
  type: TokenType.Character,
  iconId: "icon-id",
  pos: {
    x: 0,
    y: 0,
    z: 1
  }
};

const TOKEN_2: Token = {
  id: "token-2",
  type: TokenType.Character,
  iconId: "icon-id",
  pos: {
    x: 1,
    y: 1,
    z: 1
  }
};

it("adds floors", () => {
  const store = createTestStore(EMPTY_BOARD);
  store.dispatch(addFloor("icon-id", { x: 0, y: 0 }));
  expect(store.getState().board.tokens).toMatchObject([
    {
      iconId: "icon-id",
      type: TokenType.Floor,
      pos: { x: 0, y: 0, z: 0 }
    }
  ]);
});

it("adds pings", () => {
  const store = createTestStore(EMPTY_BOARD);
  store.dispatch(addPing({ x: 1, y: 1 }));
  expect(store.getState().board.tokens).toMatchObject([
    {
      type: TokenType.Ping,
      pos: { x: 1, y: 1 }
    }
  ]);
});

it("removes tokens", () => {
  const store = createTestStore({ tokens: [TOKEN_1, TOKEN_2] });
  store.dispatch(removeToken(TOKEN_1.id));
  expect(store.getState().board.tokens).toMatchObject([TOKEN_2]);
});

it("replaces tokens", () => {
  const store = createTestStore({ tokens: [TOKEN_1] });
  store.dispatch(replaceTokens([TOKEN_2]));
  expect(store.getState().board.tokens).toMatchObject([TOKEN_2]);
});

it("removes tokens from the board when they are dragged off", () => {
  const store = createTestStore({ tokens: [TOKEN_1, TOKEN_2] });
  store.dispatch(
    dragEnded({
      draggable: {
        id: "draggable-id",
        type: DraggableType.Token,
        icon: WALL_ICON,
        tokenId: TOKEN_1.id
      },
      source: {
        id: DROPPABLE_IDS.BOARD,
        bounds: { top: 0, left: 0, bottom: 10, right: 10 }
      },
      destination: {
        bounds: { top: 100, left: 100, bottom: 110, right: 110 }
      }
    })
  );

  expect(store.getState().board.tokens).toEqual([TOKEN_2]);
});

it("adds tokens to the board when they are dragged in", () => {
  const store = createTestStore({ tokens: [TOKEN_1] });
  store.dispatch(
    dragEnded({
      draggable: {
        id: "draggable-id",
        type: DraggableType.Icon,
        icon: WALL_ICON
      },
      source: {
        bounds: { top: 100, left: 100, bottom: 110, right: 110 }
      },
      destination: {
        id: DROPPABLE_IDS.BOARD,
        bounds: { top: 0, left: 0, bottom: 10, right: 10 },
        logicalLocation: {
          type: LocationType.Grid,
          x: 0,
          y: 0
        }
      }
    })
  );

  expect(store.getState().board.tokens).toMatchObject([
    TOKEN_1,
    {
      iconId: WALL_ICON.id,
      pos: { x: 0, y: 0 },
      type: TokenType.Character
    }
  ]);
});

it("moves tokens when they are dragged around inside the board", () => {
  const store = createTestStore({ tokens: [TOKEN_1, TOKEN_2] });
  store.dispatch(
    dragEnded({
      draggable: {
        id: "draggable-id",
        type: DraggableType.Token,
        icon: WALL_ICON,
        tokenId: TOKEN_1.id
      },
      source: {
        id: DROPPABLE_IDS.BOARD,
        bounds: { top: 0, left: 0, bottom: 0, right: 0 },
        logicalLocation: { type: LocationType.Grid, x: 0, y: 0 }
      },
      destination: {
        id: DROPPABLE_IDS.BOARD,
        bounds: { top: 50, left: 50, bottom: 60, right: 60 },
        logicalLocation: { type: LocationType.Grid, x: 5, y: 5 }
      }
    })
  );

  expect(store.getState().board.tokens).toEqual([
    {
      ...TOKEN_1,
      pos: {
        x: 5,
        y: 5,
        z: 1
      }
    },
    TOKEN_2
  ]);
});

it("ignores drags that don't involve the board", () => {
  const store = createTestStore({ tokens: [TOKEN_1, TOKEN_2] });
  store.dispatch(
    dragEnded({
      draggable: {
        id: "draggable-id",
        type: DraggableType.Icon,
        icon: WALL_ICON
      },
      source: {
        id: DROPPABLE_IDS.CHARACTER_TRAY,
        bounds: { top: 0, left: 0, bottom: 10, right: 10 }
      },
      destination: {
        id: DROPPABLE_IDS.CHARACTER_TRAY,
        bounds: { top: 100, left: 100, bottom: 110, right: 110 }
      }
    })
  );
});

it("ignores drags on deleted tokens", () => {
  const store = createTestStore({ tokens: [TOKEN_1, TOKEN_2] });
  // Simulate getting a network update where token 2 is deleted
  store.dispatch(replaceTokens([TOKEN_1]));
  // And now the user stopped dragging
  store.dispatch(
    dragEnded({
      draggable: {
        id: "draggable-id",
        type: DraggableType.Token,
        icon: WALL_ICON,
        tokenId: TOKEN_2.id
      },
      source: {
        id: DROPPABLE_IDS.BOARD,
        bounds: { top: 0, left: 0, bottom: 10, right: 10 },
        logicalLocation: {
          type: LocationType.Grid,
          x: 0,
          y: 0
        }
      },
      destination: {
        id: DROPPABLE_IDS.BOARD,
        bounds: { top: 50, left: 50, bottom: 60, right: 60 },
        logicalLocation: {
          type: LocationType.Grid,
          x: 5,
          y: 5
        }
      },
    })
  );

  expect(store.getState().board.tokens).toEqual([TOKEN_1]);
});
