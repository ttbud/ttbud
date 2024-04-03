import { Character, contentId, Entity, EntityType, Token } from "../../types";
import { Action } from "../../network/BoardStateApiClient";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Pos2d, { Pos3d, posAreEqual } from "../../util/shape-math";
import { assert } from "../../util/invariants";

interface Color {
  red: number;
  green: number;
  blue: number;
}

const COLORS = Object.freeze([
  { red: 255, green: 0, blue: 0 }, // Red
  { red: 0, green: 228, blue: 10 }, // Green
  { red: 0, green: 0, blue: 255 }, // Blue
  { red: 253, green: 216, blue: 53 }, // Yellow
  { red: 2, green: 213, blue: 247 }, // Cyan
  { red: 255, green: 0, blue: 255 }, // Pink
  { red: 94, green: 53, blue: 177 }, // Purple
  { red: 0, green: 0, blue: 0 }, // Black
]);

function colorsEqual(left: Color, right: Color) {
  return (
    left.red === right.red &&
    left.green === right.green &&
    left.blue === right.blue
  );
}

export interface BoardState {
  entityById: { [id: string]: Entity };
  tokenIdsByPosStr: { [pos: string]: string[] };
  charIdsByContentId: { [contentId: string]: string[] };
}

export interface ActionParams {
  boardState: BoardState;
  action: Action;
  isConfirmed: boolean;
}

export function toPosStr(pos: Pos2d) {
  return `${pos.x},${pos.y}`;
}

export function applyAction({ boardState, action, isConfirmed }: ActionParams) {
  switch (action.type) {
    case "upsert":
      upsertEntity(boardState, action.token, isConfirmed);
      break;
    case "delete":
      deleteEntity(boardState, action.entityId);
      break;
    case "ping":
      upsertEntity(boardState, action.ping, isConfirmed);
      break;
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(action);
  }
}

export function deleteEntity(boardState: BoardState, entityId: string) {
  const entity = boardState.entityById[entityId];
  if (!entity) return;

  delete boardState.entityById[entityId];

  if (entity.type !== "ping") {
    const tokenIds = boardState.tokenIdsByPosStr[toPosStr(entity.pos)];
    const idx = tokenIds.findIndex((id) => id === entityId);
    if (idx !== -1) {
      tokenIds.splice(idx, 1);
    }
  }

  if (entity.type === "character") {
    let id = contentId(entity.contents);
    const idx = boardState.charIdsByContentId[id].indexOf(entityId);
    if (idx !== -1) {
      boardState.charIdsByContentId[id].splice(idx, 1);
    }
  }
}

export function upsertEntity(
  boardState: BoardState,
  entity: Entity,
  isConfirmed: boolean
) {
  // If it's not a ping, check for collision
  if (entity.type === "floor") {
    // Check for floor collision
    const existingIds = boardState.tokenIdsByPosStr[toPosStr(entity.pos)];
    if (
      existingIds?.some(
        (id) => boardState.entityById[id].type === EntityType.Floor
      )
    ) {
      return;
    }
  } else if (entity.type === "character") {
    // Find the z-index for the new character
    const maxZ = topTokenAt(boardState, entity.pos)?.pos.z ?? 0;
    entity.pos.z = maxZ + 1;
  }

  if (boardState.entityById[entity.id]) {
    deleteEntity(boardState, entity.id);
  }
  boardState.entityById[entity.id] = entity;

  // Pings don't store the collision bookkeeping info
  if (entity.type !== "ping") {
    const posStr = toPosStr(entity.pos);
    const posIds = boardState.tokenIdsByPosStr[posStr] ?? [];
    posIds.push(entity.id);
    boardState.tokenIdsByPosStr[posStr] = posIds;
  }

  if (entity.type === "character") {
    const id = contentId(entity.contents);
    const charIds = boardState.charIdsByContentId[id] ?? [];
    charIds.push(entity.id);
    boardState.charIdsByContentId[id] = charIds;

    if (charIds.length > 1 && isConfirmed) {
      const unusedColors = [...COLORS];

      for (const charId of charIds) {
        const entity = boardState.entityById[charId] as Token;
        if (entity.type === EntityType.Character && entity.color) {
          const entityColor = entity.color;
          const idx = unusedColors.findIndex((color) =>
            colorsEqual(entityColor, color)
          );
          unusedColors.splice(idx, 1);
        }
      }

      for (const charId of charIds) {
        const entity = boardState.entityById[charId] as Character;
        if (!entity.color) {
          entity.color = unusedColors.shift();
        }
      }
    }
  }
}

export function topTokenAt(
  boardState: BoardState,
  pos: Pos2d
): Token | undefined {
  const existingIds = boardState.tokenIdsByPosStr[toPosStr(pos)];
  return existingIds?.reduce<Token | undefined>(
    (topToken: Token | undefined, currentId: string): Token => {
      const currentEntity = boardState.entityById[currentId];
      assert(currentEntity.type !== EntityType.Ping, "Ping in position map??");
      if (topToken && topToken.pos.z > currentEntity.pos.z) {
        return topToken;
      }
      return currentEntity;
    },
    undefined
  );
}

export function bottomCharacterAt(
  boardState: BoardState,
  pos: Pos2d
): Character | undefined {
  const existingIds = boardState.tokenIdsByPosStr[toPosStr(pos)];
  return existingIds?.reduce<Character | undefined>(
    (
      bottomCharacter: Character | undefined,
      currentId: string
    ): Character | undefined => {
      const currentEntity = boardState.entityById[currentId];
      assert(currentEntity.type !== EntityType.Ping, "Ping in position map??");
      if (
        currentEntity.type === EntityType.Floor ||
        (bottomCharacter && bottomCharacter.pos.z < currentEntity.pos.z)
      ) {
        return bottomCharacter;
      }
      return currentEntity;
    },
    undefined
  );
}

export function pingAt(boardState: BoardState, pos: Pos2d): string | undefined {
  return Object.values(boardState.entityById).find(
    (entity) => entity.type === EntityType.Ping && posAreEqual(entity.pos, pos)
  )?.id;
}
