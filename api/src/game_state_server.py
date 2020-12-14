import asyncio
import logging
from dataclasses import dataclass
from typing import (
    Union,
    AsyncIterator,
    Iterable,
    Callable,
    ContextManager,
    List,
    Optional,
    AsyncIterable,
)
from uuid import uuid4

import timber

from src.api.api_structures import (
    Response,
    CreateOrUpdateAction,
    DeleteAction,
    PingAction,
)
from src.api.ws_close_codes import ERR_TOO_MANY_ROOMS_CREATED, ERR_INVALID_ROOM
from src.util.assert_never import assert_never
from .game_components import Token, Ping
from .rate_limit.rate_limit import RateLimiter, TooManyRoomsCreatedException
from .room import create_room
from .room_store.room_store import RoomStore, MutationResult, RoomChangeEvent
from .util.amerge import amerge, CompleteCondition

logger = logging.getLogger(__name__)

MAX_UPDATE_RETRIES = 3
PING_LENGTH_SECS = 3


@dataclass
class DecoratedRequest:
    request_id: str
    updates: Iterable[Union[CreateOrUpdateAction, DeleteAction, PingAction]]


class InvalidConnectionException(Exception):
    close_code: int
    reason: str

    def __init__(self, close_code: int, reason: str):
        self.close_code = close_code
        self.reason = reason


@dataclass
class UpdateResult(MutationResult):
    entities: List[Union[Ping, Token]]
    messages: List[Response]
    ping_ids_created: List[str]


@dataclass
class BareUpdateResult(MutationResult):
    entities: List[Union[Ping, Token]]


async def _room_changes_to_messages(
    room_changes: AsyncIterator[RoomChangeEvent],
) -> AsyncIterator[Response]:
    async for event in room_changes:
        if event.request_id:
            yield Response('state', event.entities, event.request_id)


async def _process_updates(
    room_id: str,
    entities: Optional[List[Union[Token, Ping]]],
    updates: Iterable[Union[CreateOrUpdateAction, DeleteAction, PingAction]],
    request_id: str,
) -> UpdateResult:
    pings_created = []
    messages = []
    if entities is None:
        raise InvalidConnectionException(
            ERR_INVALID_ROOM,
            f'Tried to update room {room_id}, which does not exist',
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
                    Response('error', 'That position is occupied, bucko', request_id),
                )
        elif update.action == 'delete':
            if room.game_state.get(update.data, False):
                room.delete_token(update.data)
            else:
                messages.append(
                    Response(
                        'error',
                        'Cannot delete token because it does not exist',
                        request_id,
                    ),
                )
        elif update.action == 'ping':
            room.create_ping(update.data)
            pings_created.append(update.data.id)
        else:
            assert_never(update)

    return UpdateResult(list(room.game_state.values()), messages, pings_created)


async def _remove_pings(
    room_id: str,
    entities: Optional[List[Union[Token, Ping]]],
    ping_ids_created: List[str],
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


class GameStateServer:
    def __init__(
        self,
        room_store: RoomStore,
        apm_transaction: Callable[[str], ContextManager],
        rate_limiter: RateLimiter,
    ):
        self.room_store = room_store
        self.apm_transaction = apm_transaction
        self._rate_limiter = rate_limiter

    async def handle_connection(
        self, room_id: str, client_ip: str, requests: AsyncIterator[DecoratedRequest]
    ) -> AsyncIterable[Response]:
        """Handle a new client connection
        :param client_ip: IP address of the client
        :param room_id: The UUID that identifies the room the client
        is trying to connect to
        :param requests: The stream of requests from the connection
        :raise InvalidConnectionException: If the client connection should be rejected
        """
        session_id = str(uuid4())
        with timber.context(connection={'session_id': session_id, 'room_id': room_id}):
            async with self._rate_limiter.rate_limited_connection(client_ip, room_id):
                room_changes = await self.room_store.changes(room_id)

                with self.apm_transaction('connect'):
                    result = await self.room_store.apply_mutation(
                        room_id,
                        request_id=None,
                        mutate=lambda entities: self._acquire_room_slot(
                            room_id, entities, client_ip
                        ),
                    )
                    yield Response('connected', result.entities)

                response_msgs = self._requests_to_messages(room_id, requests)
                change_msgs = _room_changes_to_messages(room_changes)

                async for msg in amerge(
                    response_msgs,
                    change_msgs,
                    complete_when=CompleteCondition.FIRST_COMPLETED,
                ):
                    yield msg

    async def _requests_to_messages(
        self,
        room_id: str,
        requests: AsyncIterator[DecoratedRequest],
    ) -> AsyncIterator[Response]:
        async for request in requests:
            with timber.context(request={'request_id': request.request_id}):
                async for message in self._handle_request(
                    updates=request.updates,
                    room_id=room_id,
                    request_id=request.request_id,
                ):
                    yield message

    async def _handle_request(
        self,
        updates: Iterable[Union[CreateOrUpdateAction, DeleteAction, PingAction]],
        room_id: str,
        request_id: str,
    ) -> AsyncIterator[Response]:
        # Just wrap the the initial response behind a transaction, otherwise
        # each request with a ping will always take three seconds because
        # we just sleep before sending the final message
        with self.apm_transaction('update'):
            update_result = await self.room_store.apply_mutation(
                room_id,
                request_id,
                lambda entities: _process_updates(
                    room_id, entities, updates, request_id
                ),
            )

            for message in update_result.messages:
                yield message

        if update_result.ping_ids_created:
            asyncio.create_task(
                self._expire_pings(room_id, request_id, update_result.ping_ids_created)
            )

    async def _expire_pings(
        self, room_id: str, request_id: str, ping_ids: List[str]
    ) -> None:
        await asyncio.sleep(PING_LENGTH_SECS)
        await self.room_store.apply_mutation(
            room_id,
            request_id,
            lambda entities: _remove_pings(room_id, entities, ping_ids),
        )

    async def _acquire_room_slot(
        self, room_id: str, entities: Optional[List[Union[Token, Ping]]], client_ip: str
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
                    ERR_TOO_MANY_ROOMS_CREATED,
                    'Too many rooms created by client',
                )
            return BareUpdateResult([])
        return BareUpdateResult(entities)
