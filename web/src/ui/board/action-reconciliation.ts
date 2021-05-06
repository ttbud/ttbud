import { Action } from "../../network/BoardStateApiClient";
import { applyAction, BoardState } from "./board-state";
import { Token } from "../../types";
import UnreachableCaseError from "../../util/UnreachableCaseError";

export interface Update {
  updateId: string;
  actions: Action[];
}

export interface MergeState {
  network: BoardState;
  local: BoardState;
  queuedUpdates: Update[];
  unqueuedActions: Action[];
  undoState: {
    undoSets: Undo[][];
    undoIdx: number;
  };
}

function cloneBoard(state: BoardState): BoardState {
  const charIdsByContentId: { [contentId: string]: string[] } = {};
  for (const [contentId, charIds] of Object.entries(state.charIdsByContentId)) {
    charIdsByContentId[contentId] = [...charIds];
  }

  return {
    charIdsByContentId,
    tokenIdsByPosStr: { ...state.tokenIdsByPosStr },
    entityById: { ...state.entityById },
  };
}

export function applyNetworkUpdate(
  state: MergeState,
  actions: Action[],
  updateId?: string
) {
  for (const action of actions) {
    applyAction({
      boardState: state.network,
      action,
      isConfirmed: true,
    });
  }

  const updateIdx = state.queuedUpdates.findIndex(
    (pending) => pending.updateId === updateId
  );
  if (updateIdx !== -1) {
    state.queuedUpdates.splice(updateIdx, 1);
  }

  // New local state is the network state + pending and unqueued actions
  state.local = cloneBoard(state.network);
  for (const update of state.queuedUpdates) {
    for (const action of update.actions) {
      applyAction({
        boardState: state.local,
        action,
        isConfirmed: false,
      });
    }
  }

  for (const action of state.unqueuedActions) {
    applyAction({
      boardState: state.local,
      action,
      isConfirmed: false,
    });
  }
}

interface UndoDelete {
  type: "delete";
  token: Token;
}

interface UndoMove {
  type: "move";
  old: Token;
  new: Token;
}

interface UndoCreate {
  type: "create";
  token: Token;
}

type Undo = UndoDelete | UndoMove | UndoCreate;

function getUndo(state: MergeState, action: Action): Undo | null {
  switch (action.type) {
    case "delete":
      const deletedEntity = state.local.entityById[action.entityId];
      if (!deletedEntity || deletedEntity.type === "ping") return null;

      return {
        type: "delete",
        token: deletedEntity,
      };
    case "ping":
      return null;
    case "upsert":
      const entity = state.local.entityById[action.token.id];
      if (entity) {
        if (entity.type === "ping") return null;

        return {
          type: "move",
          old: entity,
          new: action.token,
        };
      } else {
        return {
          type: "create",
          token: action.token,
        };
      }
    default:
      throw new UnreachableCaseError(action);
  }
}

export function applyLocalAction(state: MergeState, action: Action) {
  const undoSets = state.undoState.undoSets;
  const undo = getUndo(state, action);
  if (undo) {
    // If you do an undoable action after you did some undos, clear the redo state
    if (state.undoState.undoIdx !== undoSets.length - 1) {
      undoSets.splice(state.undoState.undoIdx);

      undoSets.push([]);
      state.undoState.undoIdx = undoSets.length - 1;
    }

    let undoSet = undoSets[state.undoState.undoIdx];
    if (!undoSet) {
      undoSet = [];
      undoSets.push(undoSet);
    }
    undoSet.push(undo);
  }

  applyLocalActionWithoutUndos(state, action);
}

export function applyLocalActionWithoutUndos(
  state: MergeState,
  action: Action
) {
  state.unqueuedActions.push(action);
  applyAction({ boardState: state.local, action, isConfirmed: false });
}

export function applyUndoFence(state: MergeState) {
  const undoSets = state.undoState.undoSets;
  const undoSet = undoSets[undoSets.length - 1];
  if (undoSet && undoSet.length !== 0) {
    undoSets.push([]);
    state.undoState.undoIdx++;
  }
}

export function applyRedo(state: MergeState) {
  const undoSets = state.undoState.undoSets;

  if (state.undoState.undoIdx < undoSets.length - 1) {
    const undoSet = state.undoState.undoSets[state.undoState.undoIdx];

    for (const undo of undoSet) {
      switch (undo.type) {
        case "delete":
          applyLocalActionWithoutUndos(state, {
            type: "delete",
            entityId: undo.token.id,
          });
          break;
        case "create":
          applyLocalActionWithoutUndos(state, {
            type: "upsert",
            token: undo.token,
          });
          break;
        case "move":
          applyLocalActionWithoutUndos(state, {
            type: "upsert",
            token: undo.new,
          });
      }
    }

    state.undoState.undoIdx++;
  }
}

export function applyUndo(state: MergeState) {
  const undoSets = state.undoState.undoSets;

  if (state.undoState.undoIdx === 0) return;

  const undoSet = undoSets[--state.undoState.undoIdx];

  // Nothing to undo
  if (!undoSet) return;

  for (const undo of undoSet) {
    switch (undo.type) {
      case "delete":
        applyLocalActionWithoutUndos(state, {
          type: "upsert",
          token: undo.token,
        });
        break;
      case "create":
        applyLocalActionWithoutUndos(state, {
          type: "delete",
          entityId: undo.token.id,
        });
        break;
      case "move":
        applyLocalActionWithoutUndos(state, {
          type: "upsert",
          token: undo.old,
        });
        break;
      default:
        throw new UnreachableCaseError(undo);
    }
  }
}

export function collectUpdate(state: MergeState, updateId: string) {
  if (state.unqueuedActions.length === 0) return null;

  const update = { updateId, actions: state.unqueuedActions };
  state.unqueuedActions = [];
  state.queuedUpdates.push(update);
}
