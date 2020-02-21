import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../drag/drag-slice";
import { DROPPABLE_IDS } from "../ui/DroppableIds";
import { assert } from "../util/invariants";
import { DraggableType, LocationType } from "../drag/DragStateTypes";
import uuid from "uuid";
import getDragResult, { DragResult } from "./getDragResult";
import UnreachableCaseError from "../util/UnreachableCaseError";
import Pos2d from "../util/shape-math";
import { Token, TokenType } from "../network/BoardStateApiClient";

export interface BoardState {
  tokens: Token[];
}

const INITIAL_STATE: BoardState = {
  tokens: []
};

function moveToken(state: BoardState, tokenId: string, dest: Pos2d) {
  const tokenToMove = state.tokens.find(token => token.id === tokenId);
  if (!tokenToMove) {
    // The token was deleted by another person while dragging, so just ignore it
    return;
  }

  tokenToMove.pos.x = dest.x;
  tokenToMove.pos.y = dest.y;
}

function _removeToken(state: BoardState, tokenId: string) {
  state.tokens = state.tokens.filter(token => token.id !== tokenId);
}

interface AddTokenAction {
  id: string;
  iconId: string;
  pos: Pos2d;
}

interface AddPingAction {
  id: string;
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
        const token = {
          id,
          iconId,
          type: TokenType.FLOOR,
          pos: {
            ...pos,
            z: FLOOR_HEIGHT
          }
        };
        state.tokens.push(token);
      },
      prepare: (iconId: string, pos: Pos2d) => ({
        payload: { id: uuid(), iconId, pos }
      })
    },
    addPing: {
      reducer: (state, action: PayloadAction<AddPingAction>) => {
        const { id, pos } = action.payload;
        state.tokens.push({
          type: TokenType.PING,
          id,
          pos
        });
      },
      prepare: (pos: Pos2d) => ({
        payload: { id: uuid(), pos }
      })
    },
    removeToken(state, action: PayloadAction<string>) {
      _removeToken(state, action.payload);
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

          const { x, y } = destination.logicalLocation;
          state.tokens.push({
            type: TokenType.CHARACTER,
            id: uuid(),
            iconId: draggable.icon.id,
            pos: { x, y, z: CHARACTER_HEIGHT }
          });
          break;
        case DragResult.NONE:
          break;
        default:
          throw new UnreachableCaseError(dragResult);
      }
    }
  }
});

const { addFloor, addPing, removeToken, replaceTokens } = boardSlice.actions;

export { addFloor, addPing, removeToken, replaceTokens };
export default boardSlice.reducer;
