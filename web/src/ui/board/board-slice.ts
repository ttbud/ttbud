import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { assert } from "../../util/invariants";
import { v4 as uuid } from "uuid";
import Pos2d from "../../util/shape-math";
import {
  Character,
  EntityType,
  NetworkToken,
  Token,
  TokenContents,
} from "../../types";
import {
  applyLocalAction,
  applyNetworkUpdate,
  collectUpdate,
  MergeState,
} from "./action-reconciliation";
import { Action, NetworkAction } from "../../network/BoardStateApiClient";
import { AppThunk } from "../../store/createStore";
import pause from "../../util/pause";

const INITIAL_STATE: MergeState = {
  unqueuedActions: [],
  queuedUpdates: [],
  local: {
    entityById: {},
    charIdsByContentId: {},
    tokenIdsByPosStr: {},
  },
  network: {
    entityById: {},
    charIdsByContentId: {},
    tokenIdsByPosStr: {},
  },
};

interface NetworkUpdateAction {
  actions: NetworkAction[];
  updateId: string;
}

interface InternalNetworkUpdateAction {
  actions: Action[];
  updateId: string;
}

interface SetDragIdAction {
  id: string;
  newDragId: string;
}

interface UpsertCharacterAction {
  character: Character;
}

interface AddFloorAction {
  id: string;
  contents: TokenContents;
  pos: Pos2d;
}

interface AddPingAction {
  id: string;
  pos: Pos2d;
}

interface BatchUnqueuedAction {
  updateId: string;
}

export const FLOOR_HEIGHT = 0;
export const CHARACTER_HEIGHT = 1;

const boardSlice = createSlice({
  name: "board",
  initialState: INITIAL_STATE,
  reducers: {
    receiveInitialState: {
      reducer: (state, action: PayloadAction<Token[]>) => {
        applyNetworkUpdate(
          state,
          action.payload.map((token) => ({ type: "upsert", token }))
        );
      },
      prepare: (tokens: NetworkToken[]) => {
        return {
          payload: tokens.map<Token>((token) => ({ ...token, dragId: uuid() })),
        };
      },
    },
    receiveNetworkUpdate: {
      reducer: (state, action: PayloadAction<InternalNetworkUpdateAction>) => {
        const { actions, updateId } = action.payload;
        applyNetworkUpdate(state, actions, updateId);
      },
      prepare: ({ actions, updateId }: NetworkUpdateAction) => {
        const newActions: Action[] = actions.map((action): Action => {
          if (action.type === "upsert") {
            return {
              type: "upsert",
              token: {
                ...action.token,
                dragId: uuid(), // Need to look at state to pick a dragId, but can't look at state in prepare functions ??
              },
            };
          } else {
            return action;
          }
        });

        return { payload: { actions: newActions, updateId } };
      },
    },
    batchUnqueuedActions(state, action: PayloadAction<BatchUnqueuedAction>) {
      collectUpdate(state, action.payload.updateId);
    },
    clear(state) {
      for (const [id] of Object.entries(state.local.entityById)) {
        applyLocalAction(state, { type: "delete", entityId: id });
      }
    },
    setDragId(state, action: PayloadAction<SetDragIdAction>) {
      const { id, newDragId } = action.payload;
      const character = state.local.entityById[id];
      assert(
        character.type === EntityType.Character,
        "Cannot call setDragId on a non-character"
      );
      character.dragId = newDragId;
    },
    upsertCharacter(state, action: PayloadAction<UpsertCharacterAction>) {
      const { character } = action.payload;
      applyLocalAction(state, {
        type: "upsert",
        token: character,
      });
    },
    addFloor: {
      reducer: (state, action: PayloadAction<AddFloorAction>) => {
        const { id, contents, pos } = action.payload;

        applyLocalAction(state, {
          type: "upsert",
          token: {
            id,
            contents,
            type: EntityType.Floor,
            pos: {
              ...pos,
              z: FLOOR_HEIGHT,
            },
          },
        });
      },
      prepare: (contents: TokenContents, pos: Pos2d) => ({
        payload: { id: uuid(), contents, pos },
      }),
    },
    pingAdded: (state, action: PayloadAction<AddPingAction>) => {
      const { id, pos } = action.payload;
      applyLocalAction(state, {
        type: "ping",
        ping: {
          type: EntityType.Ping,
          id,
          pos,
        },
      });
    },
    removeEntity(state, action: PayloadAction<string>) {
      const id = action.payload;
      applyLocalAction(state, {
        type: "delete",
        entityId: id,
      });
    },
  },
});

function addPing(pos: Pos2d): AppThunk {
  return async (dispatch) => {
    const id = uuid();
    dispatch(pingAdded({ id, pos }));
    await pause(3000);
    dispatch(removeEntity(id));
  };
}

const {
  addFloor,
  removeEntity,
  clear,
  pingAdded,
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
  upsertCharacter,
} = boardSlice.actions;

export {
  addFloor,
  addPing,
  removeEntity,
  clear,
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
  upsertCharacter,
};
export default boardSlice.reducer;
