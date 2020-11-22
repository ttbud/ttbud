# It's important to import the whole module here because we mock sleep in tests
import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import (
    Union,
    Hashable,
    AsyncIterator,
    Iterable,
    Dict,
    Callable,
    ContextManager,
    Set,
    List,
    Optional,
)

from .api_structures import Response, CreateOrUpdateAction, DeleteAction, PingAction
from .assert_never import assert_never
from .game_components import Token, Ping
from .rate_limit import RateLimiter, TooManyRoomsCreatedException
from .room import create_room
from .room_store import RoomStore, MutationResult
from .ws_close_codes import ERR_TOO_MANY_ROOMS_CREATED, ERR_INVALID_ROOM

logger = logging.getLogger(__name__)

MAX_UPDATE_RETRIES = 3


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


@dataclass
class UpdateResult(MutationResult):
    entities: List[Union[Ping, Token]]
    messages: List[Message]
    ping_ids_created: List[str]


@dataclass
class BareUpdateResult(MutationResult):
    entities: List[Union[Ping, Token]]


class GameStateServer:
    def __init__(
        self,
        room_store: RoomStore,
        apm_transaction: Callable[[str], ContextManager],
        rate_limiter: RateLimiter,
    ):
        self.clients_by_room: Dict[str, Set[Hashable]] = defaultdict(set)
        self.room_store = room_store
        self.apm_transaction = apm_transaction
        self._rate_limiter = rate_limiter

    async def new_connection_request(
        self, client_id: Hashable, client_ip: str, room_id: str
    ) -> Message:
        """Register a new client

        :param client_id: Unique identifier for the client requesting a
        connection

        :param client_ip: IP address of the client

        :param room_id: The UUID that identifies the room the client
        is trying to connect to

        :raise InvalidConnectionException: If the client connection should be rejected
        """
        with self.apm_transaction('connect'):
            result = await self.room_store.apply_mutation(
                room_id, lambda entities: self.create_room(entities, client_ip, room_id)
            )
        self.clients_by_room[room_id].add(client_id)
        return Message({client_id}, Response('connected', result.entities))

    async def create_room(
        self, entities: Optional[List[Union[Token, Ping]]], client_ip: str, room_id: str
    ) -> BareUpdateResult:
        if not entities:
            try:
                await self._rate_limiter.acquire_new_room(client_ip)
            except TooManyRoomsCreatedException:
                logger.info(
                    f'Rejecting connection to {client_ip}, too many rooms'
                    ' created recently',
                    extra={'client_ip': client_ip, 'room_id': room_id},
                )
                raise InvalidConnectionException(
                    ERR_TOO_MANY_ROOMS_CREATED, 'Too many rooms created by client',
                )
            return BareUpdateResult([])
        return BareUpdateResult(entities)

    async def connection_dropped(self, client_id: Hashable, room_id: str) -> None:
        if self.clients_by_room.get(room_id, False):
            self.clients_by_room[room_id].remove(client_id)
            logger.info(f'{len(self.clients_by_room[room_id])} clients remaining')

    async def process_updates(
        self,
        room_id: str,
        updates: Iterable[Union[CreateOrUpdateAction, DeleteAction, PingAction]],
        entities: Optional[List[Union[Token, Ping]]],
        client_id: Hashable,
        request_id: str,
    ) -> UpdateResult:
        pings_created = []
        messages = []
        if entities is None:
            raise InvalidConnectionException(
                ERR_INVALID_ROOM,
                f'{client_id} tried to update room {room_id}, which does not exist',
            )

        room = create_room(room_id, entities)
        for update in updates:
            if update.action == 'create' or update.action == 'update':
                token = update.data
                if room.is_valid_position(token):
                    room.create_or_update_token(token)
                else:
                    logger.info(f'Token {token.id} cannot move to occupied position')
                    messages.append(
                        Message(
                            {client_id},
                            Response(
                                'error', 'That position is occupied, bucko', request_id,
                            ),
                        )
                    )
            elif update.action == 'delete':
                if room.game_state.get(update.data, False):
                    room.delete_token(update.data)
                else:
                    messages.append(
                        Message(
                            {client_id},
                            Response(
                                'error',
                                'Cannot delete token because it does not exist',
                                request_id,
                            ),
                        )
                    )
            elif update.action == 'ping':
                room.create_ping(update.data)
                pings_created.append(update.data.id)
            else:
                assert_never(update)

        return UpdateResult(list(room.game_state.values()), messages, pings_created)

    async def expire_pings(
        self,
        room_id: str,
        ping_ids_created: List[str],
        entities: Optional[List[Union[Token, Ping]]],
    ) -> BareUpdateResult:
        if entities is None:
            raise InvalidConnectionException(
                ERR_INVALID_ROOM,
                f'Tried to remove pings from room {room_id}, which does not exist',
            )
        room = create_room(room_id, entities)
        for ping_id in ping_ids_created:
            room.remove_ping_from_state(ping_id)

        return BareUpdateResult(list(room.game_state.values()))

    async def updates_received(
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
            update_result = await self.room_store.apply_mutation(
                room_id,
                lambda entities: self.process_updates(
                    room_id, updates, entities, client_id, request_id
                ),
            )

            for message in update_result.messages:
                yield message

            yield Message(
                self.clients_by_room[room_id],
                Response('state', update_result.entities, request_id),
            )

        if update_result.ping_ids_created:
            await asyncio.sleep(3)
            ping_removal_result = await self.room_store.apply_mutation(
                room_id,
                lambda entities: self.expire_pings(
                    room_id, update_result.ping_ids_created, entities
                ),
            )
            yield Message(
                self.clients_by_room[room_id],
                Response('state', ping_removal_result.entities, request_id),
            )
