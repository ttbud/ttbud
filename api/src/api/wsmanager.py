import asyncio
import json
import logging
import random
import secrets
from collections.abc import AsyncIterator
from dataclasses import asdict
from typing import (
    Any,
    NoReturn,
)
from uuid import UUID

import dacite
from dacite.exceptions import MissingValueError, WrongTypeError
from websockets.exceptions import ConnectionClosedError

from src.api.api_structures import BYPASS_RATE_LIMIT_HEADER, Request
from src.api.ws_close_codes import (
    ERR_INVALID_REQUEST,
    ERR_INVALID_UUID,
    ERR_ROOM_FULL,
    ERR_TOO_MANY_CONNECTIONS,
)
from src.apm import background_transaction
from src.game_state_server import (
    GameStateServer,
    InvalidConnectionException,
)
from src.rate_limit.rate_limit import (
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    RateLimiter,
    RoomFullException,
    TooManyConnectionsException,
)
from src.ws.ws_client import WebsocketClient

logger = logging.getLogger(__name__)


class InvalidRequestException(Exception): ...


def ignore_none(items: list[tuple[str, Any]]) -> dict[str, Any]:
    return dict(filter(lambda entry: entry[1] is not None, items))


def is_valid_uuid(uuid_string: str) -> bool:
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    return val.hex == uuid_string.replace('-', '')


async def _requests(client: WebsocketClient) -> AsyncIterator[Request]:
    async for raw_message in client.requests():
        try:
            message = json.loads(raw_message)
            request = dacite.from_dict(Request, message)
        except (json.JSONDecodeError, WrongTypeError, MissingValueError) as e:
            logger.info(
                'invalid json received from client',
                extra={'json': raw_message},
                exc_info=True,
            )
            raise InvalidRequestException() from e

        yield Request(
            actions=request.actions,
            request_id=request.request_id,
        )


class WebsocketManager:
    def __init__(
        self,
        gss: GameStateServer,
        rate_limiter: RateLimiter,
        bypass_rate_limiter_key: str,
    ) -> None:
        self._gss = gss
        self._rate_limiter = rate_limiter
        self._bypass_rate_limiter_key = bypass_rate_limiter_key
        self._clients: list[WebsocketClient] = []

    async def maintain_liveness(self) -> NoReturn:
        while True:
            with background_transaction('liveness'):
                logger.info('Refreshing liveness')
                ips = [client.ip() for client in self._clients]
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

    async def connection_handler(self, client: WebsocketClient) -> None:
        room_id = client.path().lstrip('/')
        if not is_valid_uuid(room_id):
            logger.info(f'Invalid room UUID: {room_id}')
            await client.close(code=ERR_INVALID_UUID)
            return

        await client.accept()

        self._clients.append(client)

        client_ip = client.ip()

        key_provided = client.headers().get(BYPASS_RATE_LIMIT_HEADER)

        if key_provided:
            # The load tester needs to be able to ignore the rate limiter so we
            # can actually load it without owning a bunch of IPs.
            bypass_rate_limiter = secrets.compare_digest(
                self._bypass_rate_limiter_key,
                key_provided,
            )
        else:
            bypass_rate_limiter = False

        try:
            async for response in self._gss.handle_connection(
                room_id, client_ip, _requests(client), bypass_rate_limiter
            ):
                await client.send(
                    json.dumps(asdict(response, dict_factory=ignore_none))
                )
        except InvalidRequestException:
            logger.info(
                f'Closing connection to {client_ip}, invalid request received',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_INVALID_REQUEST)
        except TooManyConnectionsException:
            logger.info(
                f'Rejecting connection to {client_ip}, too many connections for user',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_TOO_MANY_CONNECTIONS)
        except RoomFullException:
            logger.info(
                f'Rejecting connection to {client_ip}, room is full',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_ROOM_FULL)
        except InvalidConnectionException as e:
            logger.info(
                f'Rejecting connection to {client_ip}, {e.reason}',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(e.close_code)
        except ConnectionClosedError:
            # Disconnecting is a perfectly normal thing to happen, so just
            # continue cleaning up connection state
            pass

        self._clients.remove(client)
