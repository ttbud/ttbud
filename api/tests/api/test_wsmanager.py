import asyncio
from contextlib import AsyncExitStack
from uuid import uuid4

import pytest
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute

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
from src.rate_limit.rate_limit import (
    MAX_CONNECTIONS_PER_USER,
    MAX_CONNECTIONS_PER_ROOM,
    MAX_ROOMS_PER_TEN_MINUTES,
)
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.ws.starlette_ws_client import StarletteWebsocketClient
from tests import emulated_client
from tests.emulated_client import WebsocketClosed
from tests.fake_apm import fake_transaction
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


@pytest.fixture
async def wsmanager() -> WebsocketManager:
    room_store = MemoryRoomStore(MemoryRoomStorage())
    rate_limiter = MemoryRateLimiter(
        'server-id',
        MemoryRateLimiterStorage(),
    )
    gss = GameStateServer(room_store, fake_transaction, rate_limiter)
    return WebsocketManager(0, gss, rate_limiter)


@pytest.fixture
async def app(wsmanager: WebsocketManager) -> Starlette:
    # TODO: Something better
    routes = [
        WebSocketRoute(
            '/{room_id}',
            lambda websocket: wsmanager.connection_handler(
                StarletteWebsocketClient(websocket)
            ),
        )
    ]

    return Starlette(routes=routes, debug=True)


pytestmark = pytest.mark.asyncio


async def test_invalid_uuid(app: Starlette) -> None:
    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(app, '/invalid-uuid'):
            pass

    assert e.value.code == ERR_INVALID_UUID


async def test_connect(app: Starlette) -> None:
    async with emulated_client.connect(app, f'/{ROOM_ID}') as client:
        assert await client.receive_json() == {'type': 'connected', 'data': []}


async def test_add_token(app: Starlette) -> None:
    async with emulated_client.connect(app, f'/{ROOM_ID}') as client:
        # Grab the connection message
        await client.receive_json()
        await client.send_json(
            {
                'request_id': TEST_REQUEST_ID,
                'updates': [{'action': 'create', 'data': TEST_TOKEN}],
            }
        )

        assert await client.receive_json() == {
            'type': 'state',
            'request_id': TEST_REQUEST_ID,
            'data': [TEST_TOKEN],
        }


async def test_invalid_request(app: Starlette) -> None:
    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(app, f'/{ROOM_ID}') as client:
            # Wait for the initial connection message
            await client.receive_json()
            await client.send('{invalid_json')
            await client.receive_json()

    assert e.value.code == ERR_INVALID_REQUEST


async def test_too_many_user_connections(app: Starlette) -> None:
    async with AsyncExitStack() as stack:
        clients = [
            await stack.enter_async_context(emulated_client.connect(app, f'/{uuid4()}'))
            for _ in range(MAX_CONNECTIONS_PER_USER)
        ]

        first_msgs = [client.receive_json() for client in clients]
        await asyncio.gather(*first_msgs)

        with pytest.raises(WebsocketClosed) as e:
            async with emulated_client.connect(app, f'/{uuid4()}') as websocket:
                await websocket.receive_json()

        assert e.value.code == ERR_TOO_MANY_CONNECTIONS


async def test_too_many_room_connections(app: Starlette) -> None:
    async with AsyncExitStack() as stack:
        clients = [
            await stack.enter_async_context(
                emulated_client.connect(app, f'/{ROOM_ID}', client_ip=f'127.0.0.{i}')
            )
            for i in range(MAX_CONNECTIONS_PER_ROOM)
        ]

        first_msgs = [client.receive_json() for client in clients]
        await asyncio.gather(*first_msgs)

        with pytest.raises(WebsocketClosed) as e:
            async with emulated_client.connect(
                app, f'/{ROOM_ID}', client_ip='127.0.0.255'
            ) as client:
                await client.receive_json()

        assert e.value.code == ERR_ROOM_FULL


async def test_too_many_rooms_created(app: Starlette) -> None:
    for i in range(MAX_ROOMS_PER_TEN_MINUTES):
        async with emulated_client.connect(app, f'/{uuid4()}') as client:
            await client.receive_json()

    with pytest.raises(WebsocketClosed) as e:
        async with emulated_client.connect(app, f'/{uuid4()}') as client:
            await client.receive_json()

    assert e.value.code == ERR_TOO_MANY_ROOMS_CREATED
