import { Ping, Token } from "./TokenStateClient";
import { posAreEqual } from "../util/shape-math";
import uuid from "uuid";
import UnreachableCaseError from "../util/UnreachableCaseError";

export interface CreateToken {
  type: "create";
  token: Token;
}

export interface MoveToken {
  type: "move";
  token: Token;
}

export interface DeleteToken {
  type: "delete";
  tokenId: string;
}

export interface CreatePing {
  type: "ping";
  ping: Ping;
}

export type Update = CreateToken | MoveToken | DeleteToken | CreatePing;

function isUpdateOrMove(update: Update): update is CreateToken | MoveToken {
  return update.type === "create" || update.type === "move";
}

function compareById(left: Token, right: Token): number {
  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? -1 : 1;
}

function getNetworkUpdates2(
  networkTokens: Token[],
  uiTokens: Token[],
  unackedUpdates: Update[]
) {
  const sortedNetworkTokens = networkTokens.sort(compareById);
  const sortedUiTokens = uiTokens.sort(compareById);

  let uiIdx = 0;
  let networkIdx = 0;

  const updates: Update[] = [];
  while (
    uiIdx < sortedUiTokens.length &&
    networkIdx < sortedNetworkTokens.length
  ) {
    let uiToken = sortedUiTokens[uiIdx];
    let networkToken = sortedNetworkTokens[uiIdx];

    if (uiToken === undefined) {
      networkIdx++;
    } else if (networkToken === undefined) {
      uiIdx++;
    } else if (uiToken > networkToken) {
      networkIdx++;
    } else if (uiToken < networkToken) {
      uiIdx++;
    } else {
      uiIdx++;
      networkIdx++;
    }
  }
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

  const movesAndCreates = unackedUpdates.filter(isUpdateOrMove);
  const unqueuedTokens = uiTokens.filter(
    token => !movesAndCreates.some(update => update.token.id === token.id)
  );

  for (const uiToken of unqueuedTokens) {
    const networkToken = networkTokens.find(
      networkToken => networkToken.id === uiToken.id
    );

    if (!networkToken) {
      // The network doesn't have it, so tell them to create it
      createsAndMoves.push({
        type: "create",
        token: uiToken
      });
    } else if (!posAreEqual(networkToken, uiToken)) {
      // The network has it, but we have a new position, so send the new position
      createsAndMoves.push({
        type: "move",
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
      type: "delete",
      tokenId: token.id
    }));

  return createsAndMoves.concat(deletes);
}

function getNewLocalState(
  networkTokens: Token[],
  unackedUpdates: Update[]
): Token[] {
  const localState = Array.from(networkTokens);
  // Apply updates to the network state
  for (const uiUpdate of unackedUpdates) {
    switch (uiUpdate.type) {
      case "create":
        localState.push(uiUpdate.token);
        break;
      case "move":
        const idxToMove = localState.findIndex(
            networkToken => networkToken.id === uiUpdate.token.id
        );
        if (idxToMove > -1) {
          localState.splice(idxToMove, 1);
          localState.push(uiUpdate.token);
        }
        break;
      case "delete":
        const idxToDelete = localState.findIndex(
            networkToken => networkToken.id === uiUpdate.tokenId
        );
        if (idxToDelete > -1) {
          localState.splice(idxToDelete, 1);
        }
        break;
      case "ping":
        // Pings are not included in the game state right now
        break;
      default:
        throw new UnreachableCaseError(uiUpdate);
    }
  }
  return localState;
}
