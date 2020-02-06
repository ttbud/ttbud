from dataclasses import dataclass, asdict
from typing import Union, Hashable

from room_store import RoomStore


@dataclass
class Token:
    id: str
    icon_id: str
    start_x: int
    start_y: int
    start_z: int
    end_x: int
    end_y: int
    end_z: int


@dataclass
class Reply:
    type: str
    data: Union[list, str]


class RoomData:
    def __init__(self, room_id: str, initial_connection=None):
        self.room_id = room_id
        self.game_state = {}
        self.id_to_positions = {}
        self.positions_to_ids = {}
        self.clients = set()
        if initial_connection:
            self.clients.add(initial_connection)


class MessageError(Exception):
    def __init__(self, message):
        self.message = message


class GameStateServer:
    def __init__(self, room_store: RoomStore):
        self._rooms = {}
        self.room_store = room_store

    def valid_previous_rooms(self) -> list:
        return self.room_store.get_all_room_ids()

    def new_connection_request(self, client: Hashable, room_id: str) -> Reply:
        if self._rooms.get(room_id, False):
            self._rooms[room_id].clients.add(client)
        else:
            self._rooms[room_id] = RoomData(room_id, initial_connection=client)
            if self.room_store.room_data_exists(room_id):
                state_to_load = self.room_store.read_room_data(room_id)
                for token_d in state_to_load.values():
                    self._create_or_update_token(self._dict_to_token(token_d), room_id)
        return Reply('state', self.get_state(room_id))

    def connection_dropped(self, client: Hashable, room_id: str) -> None:
        if self._rooms.get(room_id, False):
            self._rooms[room_id].clients.remove(client)
            if not self._rooms[room_id].clients:
                print('Writing room data')
                self.room_store.write_room_data(
                    room_id, self._rooms[room_id].game_state
                )
                del self._rooms[room_id]
            else:
                print(f'{len(self._rooms[room_id].clients)} clients remaining')

    def process_update(self, message: dict, room_id: str) -> Reply:
        if not (self._rooms.get(room_id, False) and self._rooms[room_id].clients):
            raise MessageError('Your room does not exist, somehow')
        action = message.get('action', None)
        data = message.get('data', None)
        if not action or not data:
            raise MessageError('Did not receive a full message')

        if action == 'create' or action == 'update':
            token = self._dict_to_token(data)
            if not token or not self._is_valid_token(token):
                raise MessageError(f'Received a bad token {data}')
            if not self._is_valid_position(token, room_id):
                raise MessageError('That position is occupied, bucko')
            self._create_or_update_token(token, room_id)
            return Reply('state', self.get_state(room_id))
        elif action == 'delete':
            if type(data) != str:
                raise MessageError('Data for delete actions must be a token ID')
            if self._rooms[room_id].game_state.get(data, False):
                self._delete_token(data, room_id)
                return Reply('state', self.get_state(room_id))
            else:
                raise MessageError('Cannot delete token because it does not exist')
        elif action == 'ping':
            return Reply('ping', data)
        else:
            raise MessageError(f'Invalid action: {action}')

    @staticmethod
    def _dict_to_token(data: dict):
        try:
            token = Token(**data)
        except TypeError:
            return None
        return token

    @staticmethod
    def _is_valid_token(token: Token) -> bool:
        return (
            token.start_x < token.end_x
            and token.start_y < token.end_y
            and token.start_z < token.end_z
        )

    def _is_valid_position(self, token: Token, room_id: str) -> bool:
        blocks = self._get_unit_blocks(token)
        for block in blocks:
            if self._rooms[room_id].positions_to_ids.get(block, False):
                return False
        return True

    def _create_or_update_token(self, token: Token, room_id: str) -> None:
        print(f'New token: {token}')
        if self._rooms[room_id].game_state.get(token.id):
            self._remove_positions(token.id, room_id)

        # Update state for new or existing token
        blocks = self._get_unit_blocks(token)
        self._rooms[room_id].id_to_positions[token.id] = blocks
        for block in blocks:
            self._rooms[room_id].positions_to_ids[block] = token.id
        self._rooms[room_id].game_state[token.id] = asdict(token)

    def _delete_token(self, token_id: str, room_id: str) -> None:
        # Remove token data from position dictionaries
        self._remove_positions(token_id, room_id)
        if self._rooms[room_id].id_to_positions.get(token_id, False):
            del self._rooms[room_id].id_to_positions[token_id]
        # Remove the token from the state
        if self._rooms[room_id].game_state.get(token_id, False):
            del self._rooms[room_id].game_state[token_id]

    def _remove_positions(self, token_id: str, room_id: str) -> None:
        positions = self._rooms[room_id].id_to_positions[token_id]
        for pos in positions:
            if self._rooms[room_id].positions_to_ids.get(pos, False):
                del self._rooms[room_id].positions_to_ids[pos]

    @staticmethod
    def _get_unit_blocks(token: Token) -> list:
        unit_blocks = []
        for x in range(token.start_x, token.end_x):
            for y in range(token.start_y, token.end_y):
                for z in range(token.start_z, token.end_z):
                    unit_blocks.append((x, y, z))
        return unit_blocks

    def get_state(self, room_id: str) -> list:
        return list(self._rooms[room_id].game_state.values())

    def get_clients(self, room_id: str) -> set:
        return self._rooms[room_id].clients
