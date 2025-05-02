from collections.abc import Iterable
from copy import deepcopy

from src.api.api_structures import Action
from src.colors import colors
from src.game_components import Token, content_id


def _assign_colors(tokens: list[Token]) -> None:
    available_colors = deepcopy(colors)
    for token in tokens:
        if token.color_rgb and token.color_rgb in available_colors:
            del available_colors[available_colors.index(token.color_rgb)]
    for token in tokens:
        if not token.color_rgb:
            if not available_colors:
                return
            token.color_rgb = available_colors.pop(0)


def _get_unit_blocks(token: Token) -> list[tuple[int, int, int]]:
    unit_blocks = []
    for x in range(token.start_x, token.end_x):
        for y in range(token.start_y, token.end_y):
            for z in range(token.start_z, token.end_z):
                unit_blocks.append((x, y, z))
    return unit_blocks


class Room:
    def __init__(self) -> None:
        self.game_state: dict[str, Token] = {}
        self.id_to_positions: dict[str, list[tuple[int, int, int]]] = {}
        self.positions_to_ids: dict[tuple[int, int, int], str] = {}
        self.icon_to_token_ids: dict[str, list[str]] = {}

    def _remove_positions(self, token_id: str) -> None:
        positions = self.id_to_positions.get(token_id, [])
        for pos in positions:
            self.positions_to_ids.pop(pos, None)

    def delete_token(self, token_id: str) -> None:
        # Remove token data from position dictionaries
        self._remove_positions(token_id)
        self.id_to_positions.pop(token_id, None)
        # Remove the token from the state
        removed_token = self.game_state.pop(token_id, None)
        # Remove token from icon_id table
        if isinstance(removed_token, Token) and removed_token.type == 'character':
            self.icon_to_token_ids[content_id(removed_token.contents)].remove(
                removed_token.id
            )

    def create_or_update_token(self, token: Token) -> None:
        if self.is_valid_position(token):
            if self.game_state.get(token.id):
                self._remove_positions(token.id)
            elif token.type == 'character':
                new_content_id = content_id(token.contents)
                if self.icon_to_token_ids.get(new_content_id):
                    token_ids = self.icon_to_token_ids[new_content_id]
                    tokens_with_icon = [token]
                    for t_id in token_ids:
                        token_with_icon = self.game_state[t_id]
                        if isinstance(token_with_icon, Token):
                            tokens_with_icon.append(token_with_icon)
                    token_ids.append(token.id)
                    _assign_colors(tokens_with_icon)
                else:
                    self.icon_to_token_ids[new_content_id] = [token.id]

            # Update state for new or existing token
            if token.type == 'character' or token.type == 'floor':
                blocks = _get_unit_blocks(token)
                self.id_to_positions[token.id] = blocks
                for block in blocks:
                    self.positions_to_ids[block] = token.id
            self.game_state[token.id] = token

    def is_valid_position(self, token: Token) -> bool:
        blocks = _get_unit_blocks(token)
        return all(not self.positions_to_ids.get(block, False) for block in blocks)


def create_room(updates: Iterable[Action]) -> Room:
    room = Room()
    for update in updates:
        if update.action == 'upsert':
            room.create_or_update_token(update.data)
        elif update.action == 'delete':
            room.delete_token(update.data)
    return room
