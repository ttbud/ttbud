import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {DragEndAction, dragEnded} from "../drag/drag-slice";
import {Ping, Token} from "../network/TokenStateClient";
import {DROPPABLE_IDS} from "../ui/DroppableIds";
import {assert} from "../util/invariants";
import {DraggableType, LocationType} from "../drag/DragStateTypes";
import uuid from "uuid";
import getDragResult, {DragResult} from "./getDragResult";
import UnreachableCaseError from "../util/UnreachableCaseError";
import {AppThunk} from "./createStore";
import Pos2d from "../util/shape-math";
import timeout from "../util/timeout";

export interface CreateToken {
  type: "create";
  updateId: string;
  token: Token;
}

export interface MoveToken {
  type: "move";
  updateId: string;
  token: Token;
}

export interface DeleteToken {
  type: "delete";
  updateId: string;
  tokenId: string;
}

export interface CreatePing {
  type: "ping";
  updateId: string;
  ping: Ping;
}

export type Update = CreateToken | MoveToken | DeleteToken | CreatePing;

export interface BoardState {
  /**
   * Changes to the board that haven't been sent out over the network yet
   */
  pendingNetworkUpdates: Update[];
  tokens: Token[];
  pings: Ping[];
}

const INITIAL_STATE: BoardState = {
  pendingNetworkUpdates: [],
  tokens: [],
  pings: []
};

function moveToken(state: BoardState, tokenId: string, dest: Pos2d) {
  const tokenToMove = state.tokens.find(token => token.id === tokenId);
  if (!tokenToMove) {
    // The token was deleted by another person while dragging, so just ignore it
    return;
  }

  tokenToMove.x = dest.x;
  tokenToMove.y = dest.y;

  state.pendingNetworkUpdates.push({
    type: "move",
    updateId: uuid(),
    token: tokenToMove
  });
}

function _removeToken(state: BoardState, tokenId: string) {
  state.pendingNetworkUpdates.push({
    type: "delete",
    updateId: uuid(),
    tokenId
  });
  state.tokens = state.tokens.filter(token => token.id !== tokenId);
}

function addToken(
  state: BoardState,
  iconId: string,
  pos: Pos2d,
  height: number
) {
  const token = {
    id: uuid(),
    updateId: uuid(),
    iconId,
    x: pos.x,
    y: pos.y,
    z: height
  };

  state.pendingNetworkUpdates.push({
    type: "create",
    updateId: uuid(),
    token
  });
  state.tokens.push(token);
}

interface AddTokenAction {
  id: string;
  iconId: string;
  pos: Pos2d;
}

const FLOOR_HEIGHT = 0;
const CHARACTER_HEIGHT = 1;

const boardSlice = createSlice({
  name: "board",
  initialState: INITIAL_STATE,
  reducers: {
    replaceTokens(state, action: PayloadAction<Token[]>) {
      state.tokens = action.payload;
    },
    addFloor: {
      reducer: (state, action: PayloadAction<AddTokenAction>) => {
        const { id, iconId, pos } = action.payload;
        const token = { id, iconId, z: FLOOR_HEIGHT, ...pos };
        state.tokens.push(token);
        state.pendingNetworkUpdates.push({
          type: "create",
          updateId: uuid(),
          token: token
        });
      },
      prepare: (iconId: string, pos: Pos2d) => ({
        payload: { id: uuid(), iconId, pos }
      })
    },
    removeToken(state, action: PayloadAction<{ id: string }>) {
      const { id } = action.payload;
      _removeToken(state, id);
    },
    pingAdded(state, action: PayloadAction<Ping>) {
      const ping = action.payload;
      state.pings.push(ping);
      state.pendingNetworkUpdates.push({
        type: "ping",
        updateId: uuid(),
        ping
      });
    },
    pingRemoved(state, action: PayloadAction<{ id: string }>) {
      const { id } = action.payload;
      state.pings = state.pings.filter(ping => ping.id !== id);
    },
    recordUpdatesSent(state, action: PayloadAction<string[]>) {
      const sentUpdateIds = action.payload;
      state.pendingNetworkUpdates = state.pendingNetworkUpdates.filter(update =>
        !sentUpdateIds.includes(update.updateId)
      );
    }
  },
  extraReducers: {
    [dragEnded.type]: (state, action: PayloadAction<DragEndAction>) => {
      const { draggable, destination } = action.payload;

      const dragResult = getDragResult(DROPPABLE_IDS.BOARD, action.payload);

      switch (dragResult) {
        case DragResult.MOVED_INSIDE:
          assert(
            draggable.type === DraggableType.TOKEN,
            "Dragged from board but draggable type was not token"
          );
          assert(
            destination.logicalLocation?.type === LocationType.GRID,
            "Dropped in board but drop type was not grid"
          );
          moveToken(state, draggable.tokenId, destination.logicalLocation);
          break;
        case DragResult.DRAGGED_OUT_OF:
          assert(
            draggable.type === DraggableType.TOKEN,
            "Dragged from board but draggable type was not token"
          );

          _removeToken(state, draggable.tokenId);
          break;
        case DragResult.DRAGGED_INTO:
          assert(
            destination.logicalLocation?.type === LocationType.GRID,
            "Dropped in board but drop type was not grid"
          );

          addToken(
            state,
            draggable.icon.id,
            destination.logicalLocation,
            CHARACTER_HEIGHT
          );
          break;
        case DragResult.NONE:
          break;
        default:
          throw new UnreachableCaseError(dragResult);
      }
    }
  }
});

const {
  addFloor,
  removeToken,
  pingAdded,
  pingRemoved,
  recordUpdatesSent,
  replaceTokens
} = boardSlice.actions;

const PING_TIMEOUT_MS = 5000;

function addPing(newPing: Ping): AppThunk {
  return async (dispatch, getState) => {
    const alreadyAdded = getState().board.pings.some(
      ping => ping.id === newPing.id
    );
    if (alreadyAdded) {
      return;
    }

    dispatch(pingAdded(newPing));
    await timeout(PING_TIMEOUT_MS);
    dispatch(pingRemoved({ id: newPing.id }));
  };
}

export { addFloor, removeToken, replaceTokens, addPing, recordUpdatesSent };
export default boardSlice.reducer;
