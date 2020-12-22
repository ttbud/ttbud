import asyncio
import ipaddress
import json
import logging
import random
from dataclasses import asdict
from ssl import SSLContext
from typing import List, Tuple, Dict, Any, NoReturn, Optional, AsyncIterator
from uuid import UUID

import dacite
import websockets
from dacite.exceptions import WrongTypeError, MissingValueError
from websockets import ConnectionClosedError

from src.api.api_structures import Request
from src.api.ws_close_codes import (
    ERR_INVALID_UUID,
    ERR_TOO_MANY_CONNECTIONS,
    ERR_ROOM_FULL,
    ERR_INVALID_REQUEST,
)
from src.game_state_server import (
    InvalidConnectionException,
    GameStateServer,
    DecoratedRequest,
)
from src.rate_limit.rate_limit import (
    RateLimiter,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    TooManyConnectionsException,
    RoomFullException,
)
from src.util.async_util import race

logger = logging.getLogger(__name__)


class InvalidRequestException(Exception):
    ...


def ignore_none(items: List[Tuple[str, Any]]) -> Dict[str, Any]:
    return dict(filter(lambda entry: entry[1] is not None, items))


def is_valid_uuid(uuid_string: str) -> bool:
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    return val.hex == uuid_string.replace('-', '')


def get_client_ip(client: websockets.WebSocketServerProtocol) -> str:
    ip, _ = client.remote_address
    xff = client.request_headers.get('X-FORWARDED-FOR', '')
    last_xff_ip = xff.split(',').pop().strip()

    try:
        return str(ipaddress.ip_address(last_xff_ip))
    except ValueError:
        return str(ipaddress.ip_address(ip))


async def _decorated_requests(
    client: websockets.WebSocketServerProtocol,
) -> AsyncIterator[DecoratedRequest]:
    async for raw_message in client:
        try:
            message = json.loads(raw_message)
            request = dacite.from_dict(Request, message)
        except (json.JSONDecodeError, WrongTypeError, MissingValueError):
            logger.info(
                'invalid json received from client',
                extra={'json': raw_message},
                exc_info=True,
            )
            raise InvalidRequestException()

        yield DecoratedRequest(
            updates=request.updates,
            request_id=request.request_id,
        )


class WebsocketManager:
    def __init__(
        self, port: int, gss: GameStateServer, rate_limiter: RateLimiter
    ) -> None:
        self._port = port
        self._gss = gss
        self._rate_limiter = rate_limiter
        self._clients: List[websockets.WebSocketServerProtocol] = []

    async def listen(
        self, stop: asyncio.Future, ssl: Optional[SSLContext] = None
    ) -> None:
        try:
            await websockets.serve(
                self._connection_handler, '0.0.0.0', self._port, ssl=ssl
            )
            liveness_task = asyncio.create_task(
                self.maintain_liveness(), name='maintain_liveness'
            )

            await race(liveness_task, stop)

        except OSError:
            logger.exception('Failed to start websocket server', exc_info=True)
            raise

    async def maintain_liveness(self) -> NoReturn:
        while True:
            logger.info('Refreshing liveness')

            ips = [get_client_ip(client) for client in self._clients if client.open]
            await self._rate_limiter.refresh_server_liveness(iter(ips))

            # Offset refresh interval by a random amount to avoid all hitting
            # redis to refresh keys at the same time.
            # These numbers were chosen by the scientific process of making it up
            max_refresh_offset = SERVER_LIVENESS_EXPIRATION_SECONDS / 16
            refresh_offset = random.uniform(-max_refresh_offset, max_refresh_offset)

            # Leave plenty of wiggle room so that we can't miss our refresh
            # target just by being overloaded
            await asyncio.sleep(
                (SERVER_LIVENESS_EXPIRATION_SECONDS / 3) + refresh_offset
            )

    async def _connection_handler(
        self, client: websockets.WebSocketServerProtocol, path: str
    ) -> None:
        room_id = path.lstrip('/')
        if not is_valid_uuid(room_id):
            logger.info(f'Invalid room UUID: {room_id}')
            await client.close(
                code=ERR_INVALID_UUID, reason=f'Invalid room UUID: {room_id}'
            )
            return

        self._clients.append(client)

        client_ip = get_client_ip(client)
        try:
            logger.info(
                f'Connected to {client_ip}',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            async for response in self._gss.handle_connection(
                room_id, client_ip, _decorated_requests(client)
            ):
                await client.send(
                    json.dumps(asdict(response, dict_factory=ignore_none))
                )
        except InvalidRequestException:
            logger.info(
                f'Closing connection to {client_ip}, invalid request received',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_INVALID_REQUEST, reason='Invalid request')
        except TooManyConnectionsException:
            logger.info(
                f'Rejecting connection to {client_ip}, too many connections for user',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(
                ERR_TOO_MANY_CONNECTIONS, reason='Too many active connections'
            )
        except RoomFullException:
            logger.info(
                f'Rejecting connection to {client_ip}, room is full',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_ROOM_FULL, reason=f'The room {room_id} is full')
        except InvalidConnectionException as e:
            await client.close(e.close_code, e.reason)
        except ConnectionClosedError:
            # Disconnecting is a perfectly normal thing to happen, so just
            # continue cleaning up connection state
            pass

        self._clients.remove(client)
