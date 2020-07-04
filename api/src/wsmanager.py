import ipaddress
import logging
import asyncio
import json
from dataclasses import asdict
import random
from ssl import SSLContext
from typing import Union, List, Tuple, Dict, Any, Hashable, NoReturn, Optional
from uuid import UUID

import dacite
from dacite.exceptions import WrongTypeError, MissingValueError
import timber
import websockets
from websockets import ConnectionClosedError

from .game_state_server import (
    InvalidConnectionException,
    Message,
    GameStateServer,
)
from .api_structures import Response, Request
from .rate_limit import (
    RateLimiter,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    TooManyConnectionsException,
)
from .ws_close_codes import ERR_INVALID_UUID, ERR_TOO_MANY_CONNECTIONS

logger = logging.getLogger(__name__)


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


class WebsocketManager:
    def __init__(
        self, port: int, gss: GameStateServer, rate_limiter: RateLimiter
    ) -> None:
        self.port = port
        self.gss = gss
        self._rate_limiter = rate_limiter
        self._clients_by_id: Dict[Hashable, websockets.WebSocketServerProtocol] = {}

    async def start_websocket(self, ssl: Optional[SSLContext] = None) -> None:
        try:
            await websockets.serve(self.consumer_handler, '0.0.0.0', self.port, ssl=ssl)
            asyncio.create_task(self.maintain_liveness(), name='maintain_liveness')
        except OSError:
            logger.exception('Failed to start websocket server', exc_info=True)

    async def maintain_liveness(self) -> NoReturn:
        while True:
            logger.info("Refreshing liveness")
            await self._rate_limiter.refresh_server_liveness(
                map(
                    lambda client: client.remote_address[0],
                    self._clients_by_id.values(),
                )
            )

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

    async def consumer_handler(
        self, client: websockets.WebSocketServerProtocol, room_id: str
    ) -> None:
        room_id = room_id.lstrip('/')
        if not is_valid_uuid(room_id):
            logger.info(f'Invalid room UUID: {room_id}')
            await client.close(
                code=ERR_INVALID_UUID, reason=f'Invalid room UUID: {room_id}'
            )
            return

        self._clients_by_id[hash(client)] = client

        client_ip = get_client_ip(client)
        try:
            async with self._rate_limiter.rate_limited_connection(client_ip):
                logger.info(
                    f'Connected to {client_ip}',
                    extra={'client_ip': client_ip, 'room_id': room_id},
                )
                try:
                    response = await self.gss.new_connection_request(
                        hash(client), client_ip, room_id,
                    )
                except InvalidConnectionException as e:
                    await client.close(e.close_code, e.reason)
                    return

                await self.send_message(response)
                try:
                    async for message in client:
                        asyncio.ensure_future(self.consume(message, room_id, client))
                except ConnectionClosedError:
                    # Disconnecting is a perfectly normal thing to happen, so just
                    # continue cleaning up connection state
                    pass
                finally:
                    await self.gss.connection_dropped(hash(client), room_id)
        except TooManyConnectionsException:
            logger.info(
                f'Rejecting connection to {client_ip}, too many connections for user',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(
                ERR_TOO_MANY_CONNECTIONS, reason='Too many active connections'
            )

    async def send_message(self, message: Message) -> None:
        for target in message.targets:
            client = self._clients_by_id.get(target)
            if client:
                await client.send(
                    json.dumps(asdict(message.contents, dict_factory=ignore_none))
                )
            else:
                logger.info(
                    f'Cannot send message to target: {target} because it does not exist'
                )

    async def consume(
        self,
        json_message: Union[str, bytes],
        room_id: str,
        client: websockets.WebSocketServerProtocol,
    ) -> None:
        try:
            message = json.loads(json_message)
            request = dacite.from_dict(Request, message)
        except (json.JSONDecodeError, WrongTypeError, MissingValueError):
            logger.info(
                'invalid json received from client',
                extra={"json": json_message},
                exc_info=True,
            )
            await self.send_message(
                Message([hash(client)], Response('error', 'Invalid message format'))
            )
            return

        client_id = hash(client)
        with timber.context(
            request={
                'room_id': room_id,
                'request_id': request.request_id,
                'client_id': client_id,
            }
        ):
            try:
                async for reply in self.gss.process_updates(
                    request.updates, room_id, client_id, request.request_id
                ):
                    await self.send_message(reply)
            except Exception:
                logger.exception('Failed to process updates', exc_info=True)
                await self.send_message(
                    Message(
                        [hash(client)],
                        Response('error', 'Something went wrong', request.request_id),
                    )
                )
