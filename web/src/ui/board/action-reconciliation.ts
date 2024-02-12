import { Action } from "../../network/BoardStateApiClient";
import { applyAction, BoardState } from "./board-state";
import produce from "immer";
import { Character, EntityType } from "../../types";
import { shallowEqual } from "react-redux";

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
  for (const rawAction of actions) {
    let action = rawAction;

    //TODO: Idk man, this makes me nervous
    if (
      action.type === "upsert" &&
      action.token.type === EntityType.Character
    ) {
      let token = action.token;
      const localEntity = state.local.entityById[token.id];
      // If we have a drag id already, use it. Otherwise use the randomly generated dragId created when preparing this update
      const dragId =
        localEntity.type === EntityType.Character
          ? localEntity.dragId
          : token.dragId;
      action = {
        ...action,
        token: {
          ...action.token,
          dragId,
        },
      };
    }

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
  state.local = produce(state.network, (draft) => {
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
  // If all that changed is the local drag id of a character, we don't need to send that update over the network
  // Maybe we can delete this, since we bypass applyLocalAction in this case
  // if (
  //   action.type === "upsert" &&
  //   action.token.type === EntityType.Character &&
  //   charactersAreEqualExceptDragId(
  //     action.token,
  //     state.local.entityById[action.token.id] as Character
  //   )
  // ) {
  //   return;
  // }
  state.unqueuedActions.push(action);
  applyAction({ boardState: state.local, action, isConfirmed: false });
}

export function collectUpdate(state: MergeState, updateId: string) {
  if (state.unqueuedActions.length === 0) return null;

  const update = { updateId, actions: state.unqueuedActions };
  state.unqueuedActions = [];
  state.queuedUpdates.push(update);
}

function charactersAreEqualExceptDragId(
  left: Character,
  right: Character
): boolean {
  return (
    left.id === right.id &&
    shallowEqual(left.contents, right.contents) &&
    shallowEqual(left.color, right.color) &&
    shallowEqual(left.pos, right.pos)
  );
}
