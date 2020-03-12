from dataclasses import dataclass
from typing import Union, Hashable, AsyncIterator, Iterable, Optional, Dict, Tuple, List

# It's important to import the whole module here because we mock sleep in tests
import asyncio

from .room_store import RoomStore
from .game_components import Token, Ping


@dataclass
class MessageContents:
    type: str
    data: Union[str, Iterable[Union[Ping, Token]]]
    request_id: Optional[str] = None


@dataclass
class Message:
    targets: Iterable[Hashable]
    contents: MessageContents


class RoomData:
    def __init__(self, room_id: str, initial_connection: Optional[Hashable] = None):
        self.room_id: str = room_id
        self.game_state: Dict[str, Union[Ping, Token]] = {}
        self.id_to_positions: Dict[str, List[Tuple[int, int, int]]] = {}
        self.positions_to_ids: Dict[Tuple[int, int, int], str] = {}
        self.clients = set()
        if initial_connection:
            self.clients.add(initial_connection)


class GameStateServer:
    def __init__(self, room_store: RoomStore):
        self._rooms: Dict[str, RoomData] = {}
        self.room_store = room_store

    def new_connection_request(self, client_id: Hashable, room_id: str) -> Message:
        if self._rooms.get(room_id, False):
            self._rooms[room_id].clients.add(client_id)
        else:
            self._rooms[room_id] = RoomData(room_id, initial_connection=client_id)
                tokens_to_load = self.room_store.read_room_data(room_id)
            if tokens_to_load:
                for token_data in tokens_to_load:
                    try:
                        token = Token(**token_data)
                    except TypeError:
                        raise
                    else:
                        self._create_or_update_token(token, room_id)
        return Message(
            [client_id], MessageContents('connected', self.get_state(room_id))
        )

    def connection_dropped(self, client_id: Hashable, room_id: str) -> None:
        if self._rooms.get(room_id, False):
            self._rooms[room_id].clients.remove(client_id)
            # Save the room if the last client leaves and there is something to save
            if not self._rooms[room_id].clients and self._rooms[room_id].game_state:
                print('Writing room data')
                data_to_store: List[Token] = []
                for game_object in self._rooms[room_id].game_state.values():
                    if isinstance(game_object, Token):
                        data_to_store.append(game_object)
                self.room_store.write_room_data(room_id, data_to_store)
                del self._rooms[room_id]
            else:
                print(f'{len(self._rooms[room_id].clients)} clients remaining')

    def save_all(self):
        for room in self._rooms.values():
            if room.game_state:
                self.room_store.write_room_data(room.room_id, room.game_state)

    async def process_updates(
        self,
        updates: Iterable[dict],
        room_id: str,
        client_id: Hashable,
        request_id: str,
    ) -> AsyncIterator[Message]:
        pings_created = []
        if not (self._rooms.get(room_id, False) and self._rooms[room_id].clients):
            yield Message(
                {client_id},
                MessageContents(
                    'error', 'Your room does not exist, somehow', request_id
                ),
            )
            return
        for update in updates:
            action = update.get('action', None)
            data = update.get('data', None)
            if not action or not data:
                yield Message(
                    {client_id},
                    MessageContents(
                        'error', 'Did not receive a full update', request_id
                    ),
                )

            elif action == 'create' or action == 'update':
                try:
                    token = Token(**data)
                except TypeError:
                    yield Message(
                        {client_id},
                        MessageContents(
                            'error', f'Received bad token: {data}', request_id
                        ),
                    )
                else:
                    if not self._is_valid_token(token):
                        yield Message(
                            {client_id},
                            MessageContents(
                                'error', f'Received a bad token: {data}', request_id
                            ),
                        )
                    if not self._is_valid_position(token, room_id):
                        yield Message(
                            {client_id},
                            MessageContents(
                                'error', 'That position is occupied, bucko', request_id
                            ),
                        )
                    self._create_or_update_token(token, room_id)
            elif action == 'delete':
                if type(data) != str:
                    yield Message(
                        {client_id},
                        MessageContents(
                            'error',
                            'Data for delete actions must be a token ID',
                            request_id,
                        ),
                    )
                elif self._rooms[room_id].game_state.get(data, False):
                    self._delete_token(data, room_id)
                else:
                    yield Message(
                        {client_id},
                        MessageContents(
                            'error',
                            'Cannot delete token because it does not exist',
                            request_id,
                        ),
                    )
            elif action == 'ping':
                try:
                    ping = Ping(**data)
                except TypeError:
                    yield Message(
                        [client_id],
                        MessageContents(
                            'error', f'Received bad ping: {data}', request_id
                        ),
                    )
                else:
                    self._create_ping(ping, room_id)
                    pings_created.append(ping.id)
            else:
                print(f'Invalid action: {action}')
                yield Message(
                    {client_id},
                    MessageContents('error', f'Invalid action: {action}', request_id),
                )
        yield Message(
            self._rooms[room_id].clients,
            MessageContents('state', self.get_state(room_id), request_id),
        )

        if pings_created:
            await asyncio.sleep(3)
            for ping_id in pings_created:
                self._remove_ping_from_state(ping_id, room_id)
            yield Message(
                self._rooms[room_id].clients,
                MessageContents('state', self.get_state(room_id), request_id),
            )

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
        self._rooms[room_id].game_state[token.id] = token

    def _create_ping(self, ping: Ping, room_id: str) -> None:
        self._rooms[room_id].game_state[ping.id] = ping

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

    def _remove_ping_from_state(self, ping_id: str, room_id: str) -> None:
        ping_to_remove = self._rooms[room_id].game_state.get(ping_id)
        if ping_to_remove:
            del self._rooms[room_id].game_state[ping_id]

    @staticmethod
    def _get_unit_blocks(token: Token) -> List[Tuple[int, int, int]]:
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
