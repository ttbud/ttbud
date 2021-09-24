import asyncio
from typing import List

import pytest

from src.api.api_structures import (
    PingAction,
    Response,
    Request,
    UpdateResponse,
    ErrorResponse,
    ConnectionResponse,
)
from src.game_components import Ping
from src.game_state_server import GameStateServer
from src.rate_limit.memory_rate_limit import MemoryRateLimiterStorage, MemoryRateLimiter
from src.rate_limit.noop_rate_limit import NoopRateLimiter
from src.rate_limit.rate_limit import RateLimiter
from src.room_store.memory_room_archive import MemoryRoomArchive
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.merged_room_store import MergedRoomStore
from src.room_store.room_store import RoomStore
from src.util.async_util import async_collect
from tests.helpers import to_async_until
from tests.static_fixtures import (
    TEST_ROOM_ID,
    VALID_TOKEN,
    ANOTHER_VALID_TOKEN,
    VALID_ACTION,
    ANOTHER_VALID_ACTION,
    PING_ACTION,
    VALID_ACTION_WITH_DUPLICATE_COLOR,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def room_store() -> RoomStore:
    return MergedRoomStore(
        MemoryRoomStore(MemoryRoomStorage()),
        MemoryRoomArchive(),
    )


@pytest.fixture
def rate_limiter() -> RateLimiter:
    return MemoryRateLimiter('server-id', MemoryRateLimiterStorage())


@pytest.fixture
def gss(room_store: RoomStore, rate_limiter: RateLimiter) -> GameStateServer:
    return GameStateServer(room_store, rate_limiter, NoopRateLimiter())


def errors(responses: List[Response]) -> List[Response]:
    return list(filter(lambda response: isinstance(response, ErrorResponse), responses))


def updates(responses: List[Response]) -> List[Response]:
    return list(
        filter(lambda response: isinstance(response, UpdateResponse), responses)
    )


async def collect_responses(
    gss: GameStateServer,
    requests: List[Request],
    response_count: int,
    room_id: str = TEST_ROOM_ID,
) -> List[Response]:
    disconnect_event = asyncio.Event()
    try:
        responses = await async_collect(
            gss.handle_connection(
                room_id,
                '127.0.0.1',
                to_async_until(requests, disconnect_event),
            ),
            response_count,
        )

        return responses
    finally:
        disconnect_event.set()


async def test_new_connection(gss: GameStateServer) -> None:
    responses = await collect_responses(gss, requests=[], response_count=1)
    assert responses == [ConnectionResponse(data=[])]


async def test_room_data_is_stored(
    room_store: RoomStore, rate_limiter: RateLimiter
) -> None:
    gss_one = GameStateServer(room_store, rate_limiter, NoopRateLimiter())
    responses = await collect_responses(
        gss_one,
        requests=[
            Request(
                request_id='first-request-id',
                actions=[VALID_ACTION, ANOTHER_VALID_ACTION],
            )
        ],
        response_count=2,
    )

    assert responses == [
        ConnectionResponse([]),
        UpdateResponse([VALID_ACTION, ANOTHER_VALID_ACTION], 'first-request-id'),
    ]

    gss_two = GameStateServer(room_store, rate_limiter, NoopRateLimiter())
    responses = await collect_responses(gss_two, requests=[], response_count=1)
    assert responses == [ConnectionResponse([VALID_TOKEN, ANOTHER_VALID_TOKEN])]


async def test_ping(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[Request('ping-request-id', [PING_ACTION])],
        response_count=2,
    )
    assert responses == [
        ConnectionResponse([]),
        UpdateResponse([PING_ACTION], 'ping-request-id'),
    ]


async def test_multiple_pings(gss: GameStateServer) -> None:
    ping1 = PingAction(Ping('ping-id-1', 'ping', 0, 0))
    ping2 = PingAction(Ping('ping-id-2', 'ping', 0, 0))
    ping3 = PingAction(Ping('ping-id-3', 'ping', 0, 0))
    responses = await collect_responses(
        gss,
        requests=[
            Request(
                'ping-request-id',
                [ping1, ping2, ping3],
            )
        ],
        response_count=2,
    )
    assert responses == [
        ConnectionResponse([]),
        UpdateResponse([ping1, ping2, ping3], 'ping-request-id'),
    ]


async def test_add_duplicate_color(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[
            Request(
                'same-color-request-id',
                [VALID_ACTION, VALID_ACTION_WITH_DUPLICATE_COLOR],
            )
        ],
        response_count=2,
    )
    assert responses == [
        ConnectionResponse([]),
        UpdateResponse(
            [VALID_ACTION, VALID_ACTION_WITH_DUPLICATE_COLOR], 'same-color-request-id'
        ),
    ]
