import { posAreEqual } from "../util/shape-math";
import UnreachableCaseError from "../util/UnreachableCaseError";
import { Token } from "./BoardStateApiClient";

export enum UpdateType {
  CREATE = "create",
  MOVE = "move",
  DELETE = "delete"
}

export interface CreateToken {
  type: UpdateType.CREATE;
  token: Token;
}

export interface MoveToken {
  type: UpdateType.MOVE;
  token: Token;
}

export interface DeleteToken {
  type: UpdateType.DELETE;
  tokenId: string;
}

export type Update = CreateToken | MoveToken | DeleteToken;

function isCreateOrMove(update: Update): update is CreateToken | MoveToken {
  return update.type === "create" || update.type === "move";
}

interface DiffState {
  networkTokens: Token[];
  uiTokens: Token[];
  unackedUpdates: Update[];
}

export function getNetworkUpdates({
  networkTokens,
  uiTokens,
  unackedUpdates
}: DiffState): Update[] {
  const createsAndMoves: Update[] = [];

  const unackedCreatesAndMoves = unackedUpdates.filter(isCreateOrMove);
  const unqueuedTokens = uiTokens.filter(
    token =>
      !unackedCreatesAndMoves.some(update => update.token.id === token.id)
  );

  for (const uiToken of unqueuedTokens) {
    const networkToken = networkTokens.find(
      networkToken => networkToken.id === uiToken.id
    );

    if (!networkToken) {
      // The network doesn't have it, so tell them to create it
      createsAndMoves.push({
        type: UpdateType.CREATE,
        token: uiToken
      });
    } else if (!posAreEqual(networkToken.pos, uiToken.pos)) {
      // The network has it, but we have a new position, so send the new position
      createsAndMoves.push({
        type: UpdateType.MOVE,
        token: uiToken
      });
    }
  }

  const existsInUi = (tokenId: string) =>
    uiTokens.some(uiToken => tokenId === uiToken.id);

  const isQueuedToDelete = (tokenId: string) =>
    unackedUpdates.some(
      update => update.type === "delete" && update.tokenId === tokenId
    );

  const deletes: DeleteToken[] = networkTokens
    .filter(token => !existsInUi(token.id) && !isQueuedToDelete(token.id))
    .map(token => ({
      type: UpdateType.DELETE,
      tokenId: token.id
    }));

  return createsAndMoves.concat(deletes);
}

export function getLocalState(
  networkTokens: Token[],
  unackedUpdates: Update[]
): Token[] {
  const localState = Array.from(networkTokens);
  // Apply updates to the network state
  for (const uiUpdate of unackedUpdates) {
    switch (uiUpdate.type) {
      case UpdateType.CREATE:
        localState.push(uiUpdate.token);
        break;
      case UpdateType.MOVE:
        const idxToMove = localState.findIndex(
          networkToken => networkToken.id === uiUpdate.token.id
        );
        if (idxToMove > -1) {
          localState.splice(idxToMove, 1);
          localState.push(uiUpdate.token);
        }
        break;
      case UpdateType.DELETE:
        const idxToDelete = localState.findIndex(
          networkToken => networkToken.id === uiUpdate.tokenId
        );
        if (idxToDelete > -1) {
          localState.splice(idxToDelete, 1);
        }
        break;
      default:
        throw new UnreachableCaseError(uiUpdate);
    }
  }
  return localState;
}
