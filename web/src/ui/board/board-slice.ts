import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuid } from "uuid";
import Pos2d from "../../util/shape-math";
import { EntityType, Token } from "../../types";
import {
  applyLocalAction,
  applyNetworkUpdate,
  collectUpdate,
  MergeState,
} from "./action-reconciliation";
import { Action } from "../../network/BoardStateApiClient";
import { AppThunk } from "../../store/createStore";
import pause from "../../util/pause";
import { assert } from "../../util/invariants";

export const INITIAL_STATE: MergeState = {
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
  actions: Action[];
  updateId: string;
}

interface AddPingAction {
  id: string;
  pos: Pos2d;
}

interface BatchUnqueuedAction {
  updateId: string;
}

interface SetCharacterDragIdAction {
  characterId: string;
  dragId: string;
}

export const FLOOR_HEIGHT = 0;
export const CHARACTER_HEIGHT = 1;

const boardSlice = createSlice({
  name: "board",
  initialState: INITIAL_STATE,
  reducers: {
    receiveInitialState(state, action: PayloadAction<Token[]>) {
      applyNetworkUpdate(
        state,
        action.payload.map((token) => ({ type: "upsert", token }))
      );
    },
    receiveNetworkUpdate(state, action: PayloadAction<NetworkUpdateAction>) {
      const { actions, updateId } = action.payload;
      applyNetworkUpdate(state, actions, updateId);
    },
    batchUnqueuedActions(state, action: PayloadAction<BatchUnqueuedAction>) {
      collectUpdate(state, action.payload.updateId);
    },
    clear(state) {
      for (const [id] of Object.entries(state.local.entityById)) {
        applyLocalAction(state, { type: "delete", entityId: id });
      }
    },
    upsertToken(state, action: PayloadAction<Token>) {
      applyLocalAction(state, {
        type: "upsert",
        token: action.payload,
      });
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
    setCharacterDragId(state, action: PayloadAction<SetCharacterDragIdAction>) {
      const { characterId, dragId } = action.payload;
      const token = state.local.entityById[characterId];
      assert(
        token.type === EntityType.Character,
        `Cannot set drag id of entity of type ${token.type}`
      );
      applyLocalAction(state, {
        type: "upsert",
        token: { ...token, dragId: dragId },
      });
    },
  },
});

const PING_LENGTH_MS = 3000;
function addPing(pos: Pos2d): AppThunk {
  return async (dispatch) => {
    const id = uuid();
    dispatch(pingAdded({ id, pos }));
    await pause(PING_LENGTH_MS);
    dispatch(removeEntity(id));
  };
}

const {
  upsertToken,
  removeEntity,
  clear,
  pingAdded,
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
  setCharacterDragId,
} = boardSlice.actions;

export {
  upsertToken,
  addPing,
  removeEntity,
  clear,
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
  setCharacterDragId,
};
export default boardSlice.reducer;
