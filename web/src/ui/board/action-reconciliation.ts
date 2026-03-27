import { Action } from "../../network/BoardStateApiClient";
import { applyAction, BoardState } from "./board-state";
import produce, { current } from "immer";

export interface Update {
  updateId: string;
  actions: Action[];
}

export interface MergeState {
  network: BoardState;
  local: BoardState;
  queuedUpdates: Update[];
  unqueuedActions: Action[];
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

  // Extract a plain JavaScript snapshot of the network state to avoid Immer draft
  // pollution and shared proxy references between state.network and state.local.
  const networkSnapshot = current(state.network);

  // New local state is the network state + pending and unqueued actions
  state.local = produce(networkSnapshot, (draft) => {
    for (const update of state.queuedUpdates) {
      for (const action of update.actions) {
        applyAction({
          boardState: draft,
          action,
          isConfirmed: false,
        });
      }
    }

    for (const action of state.unqueuedActions) {
      applyAction({
        boardState: draft,
        action,
        isConfirmed: false,
      });
    }
  });
}

export function applyLocalAction(state: MergeState, action: Action) {
  state.unqueuedActions.push(action);

  applyAction({ boardState: state.local, action, isConfirmed: false });
}

export function collectUpdate(state: MergeState, updateId: string) {
  if (state.unqueuedActions.length === 0) return null;

  const update = { updateId, actions: state.unqueuedActions };
  state.unqueuedActions = [];
  state.queuedUpdates.push(update);
}
