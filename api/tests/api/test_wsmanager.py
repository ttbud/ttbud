import asyncio
from contextlib import AsyncExitStack, asynccontextmanager
from typing import AsyncIterator, Optional, Dict, cast
from uuid import uuid4

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response

from src.api.api_structures import BYPASS_RATE_LIMIT_HEADER
from src.api.ws_close_codes import (
    ERR_INVALID_UUID,
    ERR_TOO_MANY_CONNECTIONS,
    ERR_ROOM_FULL,
    ERR_INVALID_REQUEST,
    ERR_TOO_MANY_ROOMS_CREATED,
)
from src.api.wsmanager import WebsocketManager
from src.game_state_server import GameStateServer
from src.rate_limit.memory_rate_limit import MemoryRateLimiter, MemoryRateLimiterStorage
from src.rate_limit.noop_rate_limit import NoopRateLimiter
from src.rate_limit.rate_limit import (
    MAX_CONNECTIONS_PER_USER,
    MAX_CONNECTIONS_PER_ROOM,
    MAX_ROOMS_PER_TEN_MINUTES,
)
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.routes import routes
from tests import emulated_client
from tests.emulated_client import WebsocketClosed, EmulatedClient, WebsocketAsgiApp
from tests.helpers import assert_matches
from tests.static_fixtures import TEST_REQUEST_ID

SERVER_ID = 'server-id'
ROOM_ID = 'c001678f-ffbe-4191-b948-64cd2a48d058'

TEST_TOKEN = {
    'id': 'token-id',
    'type': 'character',
    'contents': {'text': 'TXT'},
    'start_x': 0,
    'start_y': 0,
    'start_z': 0,
    'end_x': 1,
    'end_y': 1,
    'end_z': 1,
}

TEST_UPSERT_TOKEN = {
    'data': TEST_TOKEN,
    'action': 'upsert',
}

TEST_BYPASS_RATE_LIMIT_KEY = '1234'


async def noop_endpoint(request: Request) -> Response:
    return Response('')


@pytest.fixture
async def app() -> WebsocketAsgiApp:
    room_store = MemoryRoomStore(MemoryRoomStorage())
    rate_limiter = MemoryRateLimiter(
        'server-id',
        MemoryRateLimiterStorage(),
    )
    gss = GameStateServer(room_store, rate_limiter, NoopRateLimiter())
    ws = WebsocketManager(gss, rate_limiter, TEST_BYPASS_RATE_LIMIT_KEY)
    # Starlette has looser definitions than WebsocketAsgiApp but otherwise fits
    # the protocol requirements
    return cast(
        WebsocketAsgiApp, Starlette(routes=routes(noop_endpoint, ws), debug=True)
    )


pytestmark = pytest.mark.asyncio


@asynccontextmanager
async def num_active_connections(
    app: WebsocketAsgiApp,
    num_connections: int,
    *,
    headers: Optional[Dict] = None,
    unique_ips: bool = True,
    unique_rooms: bool = True,
) -> AsyncIterator[None]:
    async with AsyncExitStack() as stack:

        async def connect(i: int) -> EmulatedClient:
            ip = f'127.0.0.{i}' if unique_ips else '127.0.0.1'
            room_id = uuid4() if unique_rooms else ROOM_ID
            return await stack.enter_async_context(
                emulated_client.connect(
                    app, f'/{room_id}', client_ip=ip, headers=headers
                )
            )

        clients = [await connect(i) for i in range(num_connections)]
        first_msgs = [client.receive_json() for client in clients]
        await asyncio.gather(*first_msgs)
        yield


async def test_invalid_uuid(app: WebsocketAsgiApp) -> None:
    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(app, '/invalid-uuid'):
            pass

    assert e.value.code == ERR_INVALID_UUID


async def test_connect(app: WebsocketAsgiApp) -> None:
    async with emulated_client.connect(app, f'/{ROOM_ID}') as client:
        assert await client.receive_json() == {'type': 'connected', 'data': []}


async def test_add_token(app: WebsocketAsgiApp) -> None:
    async with emulated_client.connect(app, f'/{ROOM_ID}') as client:
        # Grab the connection message
        await client.receive_json()
        await client.send_json(
            {
                'request_id': TEST_REQUEST_ID,
                'actions': [TEST_UPSERT_TOKEN],
            }
        )

        assert_matches(
            await client.receive_json(),
            {
                'type': 'update',
                'request_id': TEST_REQUEST_ID,
                'actions': [TEST_UPSERT_TOKEN],
            },
        )


async def test_invalid_request(app: WebsocketAsgiApp) -> None:
    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(app, f'/{ROOM_ID}') as client:
            # Wait for the initial connection message
            await client.receive_json()
            await client.send('{invalid_json')
            await client.receive_json()

    assert e.value.code == ERR_INVALID_REQUEST


async def test_too_many_user_connections(app: WebsocketAsgiApp) -> None:
    async with num_active_connections(app, MAX_CONNECTIONS_PER_USER, unique_ips=False):
        with pytest.raises(WebsocketClosed) as e:
            async with emulated_client.connect(
                app, f'/{uuid4()}', client_ip='127.0.0.1'
            ) as websocket:
                await websocket.receive_json()

    assert e.value.code == ERR_TOO_MANY_CONNECTIONS


async def test_too_many_room_connections(app: WebsocketAsgiApp) -> None:
    async with num_active_connections(
        app, MAX_CONNECTIONS_PER_ROOM, unique_rooms=False
    ):
        with pytest.raises(WebsocketClosed) as e:
            async with emulated_client.connect(
                app, f'/{ROOM_ID}', client_ip='127.0.0.255'
            ) as client:
                await client.receive_json()

        assert e.value.code == ERR_ROOM_FULL


async def test_too_many_rooms_created(app: WebsocketAsgiApp) -> None:
    for i in range(MAX_ROOMS_PER_TEN_MINUTES):
        async with emulated_client.connect(app, f'/{uuid4()}') as client:
            await client.receive_json()

    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(app, f'/{uuid4()}') as client:
            await client.receive_json()

    assert e.value.code == ERR_TOO_MANY_ROOMS_CREATED


async def test_bypass_room_create_rate_limit(app: WebsocketAsgiApp) -> None:
    headers = {BYPASS_RATE_LIMIT_HEADER: TEST_BYPASS_RATE_LIMIT_KEY}
    for i in range(MAX_ROOMS_PER_TEN_MINUTES):
        async with emulated_client.connect(
            app, f'/{uuid4()}', headers=headers
        ) as client:
            await client.receive_json()

    async with emulated_client.connect(app, f'/{uuid4()}', headers=headers) as client:
        assert await client.receive_json() == {'type': 'connected', 'data': []}


async def test_bypass_max_connections_rate_limit(app: WebsocketAsgiApp) -> None:
    headers = {BYPASS_RATE_LIMIT_HEADER: TEST_BYPASS_RATE_LIMIT_KEY}
    async with num_active_connections(
        app, MAX_CONNECTIONS_PER_USER, unique_ips=False, headers=headers
    ):
        async with emulated_client.connect(
            app, f'/{uuid4()}', headers=headers
        ) as client:
            assert await client.receive_json() == {'type': 'connected', 'data': []}


async def test_bypass_room_create_rate_limit_invalid_key(app: WebsocketAsgiApp) -> None:
    headers = {BYPASS_RATE_LIMIT_HEADER: "invalid-key"}
    for i in range(MAX_ROOMS_PER_TEN_MINUTES):
        async with emulated_client.connect(
            app, f'/{uuid4()}', headers=headers
        ) as client:
            await client.receive_json()

    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(
            app, f'/{uuid4()}', headers=headers
        ) as client:
            await client.receive_json()

    assert e.value.code == ERR_TOO_MANY_ROOMS_CREATED


async def test_bypass_max_connections_rate_limit_invalid_key(
    app: WebsocketAsgiApp,
) -> None:
    headers = {BYPASS_RATE_LIMIT_HEADER: "invalid-key"}
    async with num_active_connections(
        app, MAX_CONNECTIONS_PER_USER, unique_ips=False, headers=headers
    ):
        with pytest.raises(WebsocketClosed) as e:
            async with emulated_client.connect(
                app, f'/{uuid4()}', headers=headers
            ) as websocket:
                await websocket.receive_json()

        assert e.value.code == ERR_TOO_MANY_CONNECTIONS
