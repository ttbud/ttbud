from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import (
    AsyncIterator,
    Callable,
    ContextManager,
    List,
    AsyncIterable,
    Dict,
)
from uuid import uuid4

import timber

from src.api.api_structures import (
    Response,
    Request,
    UpdateResponse,
    ConnectionResponse,
)
from src.api.ws_close_codes import ERR_TOO_MANY_ROOMS_CREATED, ERR_INVALID_ROOM
from .rate_limit.rate_limit import RateLimiter, TooManyRoomsCreatedException
from .room import create_room
from .room_store.room_store import RoomStore
from .util.async_util import items_until, all_items

logger = logging.getLogger(__name__)

MAX_UPDATE_RETRIES = 3
PING_LENGTH_SECS = 3


class InvalidConnectionException(Exception):
    close_code: int
    reason: str

    def __init__(self, close_code: int, reason: str):
        self.close_code = close_code
        self.reason = reason


@dataclass
class ChangeListener:
    output_queues: List[asyncio.Queue[Response]]
    task: asyncio.Task


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
        self._change_listener_by_id: Dict[str, ChangeListener] = {}

    async def _listen_for_changes(
        self,
        room_id: str,
        queues: List[asyncio.Queue[Response]],
        updates: AsyncIterator[Request],
    ) -> None:
        async for response in self._room_changes_to_messages(room_id, updates):
            for q in queues:
                await q.put(response)

    async def _process_requests(
        self, room_id: str, requests: AsyncIterator[Request]
    ) -> None:
        async for request in requests:
            await self.room_store.add_request(room_id, request)

    async def handle_connection(
        self, room_id: str, client_ip: str, requests: AsyncIterator[Request]
    ) -> AsyncIterable[Response]:
        """Handle a new client connection
        :param client_ip: IP address of the client
        :param room_id: The UUID that identifies the room the client
        is trying to connect to
        :param requests: The stream of requests from the connection
        :raise InvalidConnectionException: If the client connection should be rejected
        """
        session_id = str(uuid4())
        with timber.context(
            connection={
                'session_id': session_id,
                'room_id': room_id,
                'client_ip': client_ip,
            }
        ):
            logger.info(f'Connected to {client_ip}')
            async with self._rate_limiter.rate_limited_connection(client_ip, room_id):
                listener_q: asyncio.Queue[Response] = asyncio.Queue()

                with self.apm_transaction('connect'):
                    if not self._change_listener_by_id.get(room_id):
                        await self._acquire_room_slot(room_id, client_ip)
                        queues: List[asyncio.Queue[Response]] = []
                        updates = await self.room_store.changes(room_id)
                        change_listener = ChangeListener(
                            queues,
                            asyncio.create_task(
                                self._listen_for_changes(room_id, queues, updates)
                            ),
                        )
                        self._change_listener_by_id[room_id] = change_listener
                    self._change_listener_by_id[room_id].output_queues.append(
                        listener_q
                    )

                    room = create_room(await self.room_store.read(room_id))
                    yield ConnectionResponse(list(room.game_state.values()))

                try:
                    request_task = asyncio.create_task(
                        self._process_requests(room_id, requests)
                    )
                    async for msg in items_until(all_items(listener_q), request_task):
                        yield msg
                finally:
                    request_task.cancel()
                    change_listener = self._change_listener_by_id[room_id]
                    queues = change_listener.output_queues
                    queues.remove(listener_q)
                    if not queues:
                        change_listener.task.cancel()
                        del self._change_listener_by_id[room_id]

    async def _room_changes_to_messages(
        self,
        room_id: str,
        room_changes: AsyncIterator[Request],
    ) -> AsyncIterator[Response]:
        async for request in room_changes:
            if request.request_id:
                with self.apm_transaction('update'):
                    change_listener = self._change_listener_by_id.get(room_id)
                    if not change_listener:
                        raise InvalidConnectionException(
                            ERR_INVALID_ROOM,
                            f'Tried to update room {room_id}, which does not exist',
                        )

                    yield UpdateResponse(request.actions, request.request_id)

    async def _acquire_room_slot(self, room_id: str, client_ip: str) -> None:
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
