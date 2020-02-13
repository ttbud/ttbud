import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "./drag-slice";
import { Ping, Token } from "../network/TokenStateClient";
import { DROPPABLE_IDS } from "../ui/DroppableIds";
import { assert } from "../util/invariants";
import { DraggableType, LocationType } from "../ui/drag/DragStateTypes";
import uuid from "uuid";
import getDragResult, { DragResult } from "./getDragResult";
import UnreachableCaseError from "../util/UnreachableCaseError";
import { AppThunk } from "./createStore";
import Pos2d from "../util/shape-math";

export interface BoardState {
  tokens: Token[];
  pings: Ping[];
}

const INITIAL_STATE: BoardState = {
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
}

function _removeToken(state: BoardState, tokenId: String) {
  state.tokens = state.tokens.filter(token => token.id !== tokenId);
}

function addToken(
  state: BoardState,
  iconId: string,
  pos: Pos2d,
  height: number
) {
  state.tokens.push({
    id: uuid(),
    iconId,
    x: pos.x,
    y: pos.y,
    z: height
  });
}

interface AddTokenAction {
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
    addFloor(state, action: PayloadAction<AddTokenAction>) {
      const { iconId, pos } = action.payload;
      addToken(state, iconId, pos, FLOOR_HEIGHT);
    },
    removeToken(state, action: PayloadAction<{ id: string }>) {
      const { id } = action.payload;
      _removeToken(state, id);
    },
    pingAdded(state, action: PayloadAction<Ping>) {
      state.pings.push(action.payload);
    },
    pingRemoved(state, action: PayloadAction<{ id: string }>) {
      const { id } = action.payload;
      state.pings = state.pings.filter(ping => ping.id !== id);
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
  replaceTokens
} = boardSlice.actions;

const PING_TIMEOUT_MS = 5000;

function addPing(ping: Ping): AppThunk {
  return dispatch => {
    dispatch(pingAdded(ping));
    window.setTimeout(
      () => dispatch(pingRemoved({ id: ping.id })),
      PING_TIMEOUT_MS
    );
  };
}

export { addFloor, removeToken, replaceTokens, addPing };
export default boardSlice.reducer;
