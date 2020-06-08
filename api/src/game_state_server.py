import logging
from dataclasses import dataclass
from typing import (
    Union,
    Hashable,
    AsyncIterator,
    Iterable,
    Optional,
    Dict,
    Tuple,
    List,
    Callable,
)
from copy import deepcopy

# It's important to import the whole module here because we mock sleep in tests
import asyncio
from dacite import (
    from_dict,
    WrongTypeError,
    MissingValueError,
)

from .api_structures import Response, CreateOrUpdateAction, DeleteAction, PingAction
from .assert_never import assert_never
from .apm import ApmTransaction
from .room_store import RoomStore
from .game_components import Token, Ping, content_id
from .ws_close_codes import ERR_ROOM_FULL
from .colors import colors


logger = logging.getLogger(__name__)


MAX_USERS_PER_ROOM = 20


def assign_colors(tokens: List[Token]) -> None:
    available_colors = deepcopy(colors)
    for token in tokens:
        if token.color_rgb:
            if token.color_rgb in available_colors:
                del available_colors[available_colors.index(token.color_rgb)]
            else:
                raise TypeError(f'Unknown color: {token.color_rgb}')
    for token in tokens:
        if not token.color_rgb:
            if not available_colors:
                logger.info(f'Max colors reached for icon {content_id(token.contents)}')
                return
            logger.info(f'Add color {available_colors[0]} to token {token.id}')
            token.color_rgb = available_colors.pop(0)


@dataclass
class Message:
    targets: Iterable[Hashable]
    contents: Response


class InvalidConnectionException(Exception):
    close_code: int
    reason: str

    def __init__(self, close_code: int, reason: str):
        self.close_code = close_code
        self.reason = reason


class RoomData:
    def __init__(self, room_id: str, initial_connection: Optional[Hashable] = None):
        self.room_id: str = room_id
        self.game_state: Dict[str, Union[Ping, Token]] = {}
        self.id_to_positions: Dict[str, List[Tuple[int, int, int]]] = {}
        self.positions_to_ids: Dict[Tuple[int, int, int], str] = {}
        self.icon_to_token_ids: Dict[str, List[str]] = {}
        self.clients = set()
        if initial_connection:
            self.clients.add(initial_connection)


class GameStateServer:
    def __init__(
        self, room_store: RoomStore, apm_transaction: Callable[[str], ApmTransaction]
    ):
        self._rooms: Dict[str, RoomData] = {}
        self.room_store = room_store
        self.apm_transaction = apm_transaction

    async def new_connection_request(
        self, client_id: Hashable, room_id: str
    ) -> Message:
        """Register a new client

        :param client_id: Unique identifier for the client requesting a
        connection

        :param room_id: The UUID that identifies the room the client
        is trying to connect to

        :raise InvalidConnectionException: If the client connection should be rejected
        """
        with self.apm_transaction('connect'):
            if self._rooms.get(room_id, False):
                if len(self._rooms[room_id].clients) <= MAX_USERS_PER_ROOM:
                    self._rooms[room_id].clients.add(client_id)
                else:
                    raise InvalidConnectionException(
                        ERR_ROOM_FULL, f'The room ${room_id} is full'
                    )
            else:
                self._rooms[room_id] = RoomData(room_id, initial_connection=client_id)
                tokens_to_load = await self.room_store.read_room_data(room_id)
                if tokens_to_load:
                    for token_data in tokens_to_load:
                        try:
                            token = from_dict(data_class=Token, data=token_data)
                        except (WrongTypeError, MissingValueError, TypeError):
                            # Don't raise here. Loading a room minus any tokens that
                            # havebeen corrupted is still valuable.
                            logger.exception(
                                f'Corrupted room {room_id}',
                                extra={"invalid_token": token_data},
                                exc_info=True,
                            )
                    else:
                        self._create_or_update_token(token, room_id)

        return Message({client_id}, Response('connected', self.get_state(room_id)))

    async def connection_dropped(self, client_id: Hashable, room_id: str) -> None:
        if self._rooms.get(room_id, False):
            self._rooms[room_id].clients.remove(client_id)
            # Save the room if the last client leaves and there is something to save
            if not self._rooms[room_id].clients and self._rooms[room_id].game_state:
                await self.save_room(room_id)
                del self._rooms[room_id]
            else:
                logger.info(f'{len(self._rooms[room_id].clients)} clients remaining')

    async def save_all(self) -> None:
        for room in self._rooms.values():
            if room.game_state:
                await self.save_room(room.room_id)
        logger.info('All rooms saved')

    async def save_room(self, room_id: str) -> None:
        logger.info(f'Saving room {room_id}')
        data_to_store = []
        for game_object in self._rooms[room_id].game_state.values():
            if isinstance(game_object, Token):
                data_to_store.append(game_object)
        await self.room_store.write_room_data(room_id, data_to_store)

    async def process_updates(
        self,
        updates: Iterable[Union[CreateOrUpdateAction, DeleteAction, PingAction]],
        room_id: str,
        client_id: Hashable,
        request_id: str,
    ) -> AsyncIterator[Message]:
        # Just wrap the the initial response behind a transaction, otherwise
        # each request with a ping will always take three seconds because
        # we just sleep before sending the final message
        with self.apm_transaction('update'):
            pings_created = []
            if not (self._rooms.get(room_id, False) and self._rooms[room_id].clients):
                yield Message(
                    {client_id},
                    Response('error', 'Your room does not exist, somehow', request_id),
                )
                return

            for update in updates:
                if update.action == 'create' or update.action == 'update':
                    token = update.data
                    if self._is_valid_position(token, room_id):
                        self._create_or_update_token(token, room_id)
                    else:
                        logger.info(
                            f'Token {token.id} cannot move to occupied position'
                        )
                        yield Message(
                            {client_id},
                            Response(
                                'error', 'That position is occupied, bucko', request_id,
                            ),
                        )
                elif update.action == 'delete':
                    if self._rooms[room_id].game_state.get(update.data, False):
                        self._delete_token(update.data, room_id)
                    else:
                        yield Message(
                            {client_id},
                            Response(
                                'error',
                                'Cannot delete token because it does not exist',
                                request_id,
                            ),
                        )
                elif update.action == 'ping':
                    self._create_ping(update.data, room_id)
                    pings_created.append(update.data.id)
                else:
                    assert_never(update)

        yield Message(
            self._rooms[room_id].clients,
            Response('state', self.get_state(room_id), request_id),
        )

        if pings_created:
            await asyncio.sleep(3)
            for ping_id in pings_created:
                self._remove_ping_from_state(ping_id, room_id)

            yield Message(
                self._rooms[room_id].clients,
                Response('state', self.get_state(room_id), request_id),
            )

    def _is_valid_position(self, token: Token, room_id: str) -> bool:
        blocks = self._get_unit_blocks(token)
        for block in blocks:
            if self._rooms[room_id].positions_to_ids.get(block, False):
                return False
        return True

    def _create_or_update_token(self, token: Token, room_id: str) -> None:
        logger.info(f'New token: {token}')
        if self._rooms[room_id].game_state.get(token.id):
            self._remove_positions(token.id, room_id)
        elif token.type.lower() == 'character':
            new_content_id = content_id(token.contents)
            if self._rooms[room_id].icon_to_token_ids.get(new_content_id):
                token_ids = self._rooms[room_id].icon_to_token_ids[new_content_id]
                tokens_with_icon = [token]
                for t_id in token_ids:
                    token_with_icon = self._rooms[room_id].game_state[t_id]
                    if isinstance(token_with_icon, Token):
                        tokens_with_icon.append(token_with_icon)
                token_ids.append(token.id)
                assign_colors(tokens_with_icon)
            else:
                self._rooms[room_id].icon_to_token_ids[new_content_id] = [token.id]

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
        self._rooms[room_id].id_to_positions.pop(token_id, None)
        # Remove the token from the state
        removed_token = self._rooms[room_id].game_state.pop(token_id, None)
        # Remove token from icon_id table
        if (
            isinstance(removed_token, Token)
            and removed_token.type.lower() == 'character'
        ):
            self._rooms[room_id].icon_to_token_ids[
                content_id(removed_token.contents)
            ].remove(removed_token.id)

    def _remove_positions(self, token_id: str, room_id: str) -> None:
        positions = self._rooms[room_id].id_to_positions[token_id]
        for pos in positions:
            self._rooms[room_id].positions_to_ids.pop(pos, None)

    def _remove_ping_from_state(self, ping_id: str, room_id: str) -> None:
        self._rooms[room_id].game_state.pop(ping_id, None)

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
