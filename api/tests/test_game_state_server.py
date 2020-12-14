import asyncio
from typing import List

import pytest

from src.api.api_structures import (
    CreateOrUpdateAction,
    DeleteAction,
    PingAction,
    Response,
)
from src.colors import colors
from src.game_components import Token, IconTokenContents
from src.game_state_server import (
    GameStateServer,
    DecoratedRequest,
)
from src.rate_limit.memory_rate_limit import MemoryRateLimiterStorage, MemoryRateLimiter
from src.rate_limit.rate_limit import RateLimiter
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.room_store import RoomStore
from src.util.async_util import async_collect
from tests.fake_apm import fake_transaction
from tests.helpers import to_async_until, assert_matches
from tests.static_fixtures import (
    TEST_ROOM_ID,
    VALID_TOKEN,
    ANOTHER_VALID_TOKEN,
    UPDATED_TOKEN,
    VALID_ACTION,
    ANOTHER_VALID_ACTION,
    VALID_PING,
    DELETE_VALID_TOKEN,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def room_store() -> RoomStore:
    return MemoryRoomStore(MemoryRoomStorage())


@pytest.fixture
def rate_limiter() -> RateLimiter:
    return MemoryRateLimiter('server-id', MemoryRateLimiterStorage())


@pytest.fixture
def gss(room_store: RoomStore, rate_limiter: RateLimiter) -> GameStateServer:
    return GameStateServer(room_store, fake_transaction, rate_limiter)


def errors(responses: List[Response]) -> List[Response]:
    return list(filter(lambda response: response.type == 'error', responses))


def states(responses: List[Response]) -> List[Response]:
    return list(filter(lambda response: response.type == 'state', responses))


async def collect_responses(
    gss: GameStateServer,
    requests: List[DecoratedRequest],
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
    assert responses == [Response('connected', data=[])]


async def test_room_data_is_stored(
    room_store: RoomStore, rate_limiter: RateLimiter
) -> None:
    gss_one = GameStateServer(room_store, fake_transaction, rate_limiter)
    responses = await collect_responses(
        gss_one,
        requests=[
            DecoratedRequest(
                request_id='first-request-id',
                updates=[VALID_ACTION, ANOTHER_VALID_ACTION],
            )
        ],
        response_count=2,
    )

    assert responses == [
        Response('connected', []),
        Response('state', [VALID_TOKEN, ANOTHER_VALID_TOKEN], 'first-request-id'),
    ]

    gss_two = GameStateServer(room_store, fake_transaction, rate_limiter)
    responses = await collect_responses(gss_two, requests=[], response_count=1)
    assert responses == [Response('connected', [VALID_TOKEN, ANOTHER_VALID_TOKEN])]


async def test_duplicate_update_rejected(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[
            DecoratedRequest(
                request_id='request-id', updates=[VALID_ACTION, VALID_ACTION]
            )
        ],
        response_count=3,
    )

    assert states(responses) == [Response('state', [VALID_TOKEN], 'request-id')]
    assert_matches(errors(responses), [{'type': 'error', 'request_id': 'request-id'}])


async def test_duplicate_update_in_different_room(gss: GameStateServer) -> None:

    responses = await collect_responses(
        gss,
        requests=[DecoratedRequest('request-id-1', [VALID_ACTION])],
        response_count=2,
        room_id='room-1',
    )

    assert responses == [
        Response('connected', []),
        Response('state', [VALID_TOKEN], 'request-id-1'),
    ]

    responses = await collect_responses(
        gss,
        requests=[DecoratedRequest('request-id-2', [VALID_ACTION])],
        response_count=2,
        room_id='room-2',
    )

    assert responses == [
        Response('connected', []),
        Response('state', [VALID_TOKEN], 'request-id-2'),
    ]


async def test_update_in_occupied_position(gss: GameStateServer) -> None:
    conflicting_position_token = Token(
        'some_other_id',
        'character',
        IconTokenContents('some_other_icon_id'),
        start_x=0,
        start_y=0,
        start_z=0,
        end_x=1,
        end_y=1,
        end_z=1,
        color_rgb=colors[0],
    )
    responses = await collect_responses(
        gss,
        requests=[
            DecoratedRequest('good-request-id', [VALID_ACTION]),
            DecoratedRequest(
                'bad-request-id',
                [
                    CreateOrUpdateAction(
                        action='create', data=conflicting_position_token
                    )
                ],
            ),
        ],
        response_count=3,
    )

    assert states(responses) == [Response('state', [VALID_TOKEN], 'good-request-id')]
    assert_matches(
        errors(responses), [{'type': 'error', 'request_id': 'bad-request-id'}]
    )


async def test_delete_token(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[
            DecoratedRequest('create-request-id', [VALID_ACTION]),
            DecoratedRequest(
                'delete-request-id',
                [DeleteAction(action='delete', data=VALID_TOKEN.id)],
            ),
        ],
        response_count=3,
    )
    assert responses == [
        Response('connected', []),
        Response('state', [VALID_TOKEN], 'create-request-id'),
        Response('state', [], 'delete-request-id'),
    ]


async def test_delete_non_existent_token(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[
            DecoratedRequest(
                'delete-request-id',
                [DeleteAction(action='delete', data='unused-token-id')],
            )
        ],
        response_count=3,
    )

    assert states(responses) == [Response('state', [], 'delete-request-id')]
    assert_matches(
        errors(responses), [{'type': 'error', 'request_id': 'delete-request-id'}]
    )


async def test_delete_after_reload(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[DecoratedRequest('create-request-id', [VALID_ACTION])],
        response_count=2,
    )
    assert responses == [
        Response('connected', []),
        Response('state', [VALID_TOKEN], 'create-request-id'),
    ]

    responses = await collect_responses(
        gss,
        requests=[DecoratedRequest('delete-request-id', [DELETE_VALID_TOKEN])],
        response_count=2,
    )
    assert responses == [
        Response('connected', [VALID_TOKEN]),
        Response('state', [], 'delete-request-id'),
    ]


async def test_move_existing_token(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[
            DecoratedRequest('create-request-id', [VALID_ACTION]),
            DecoratedRequest(
                'move-request-id',
                [CreateOrUpdateAction(action='update', data=UPDATED_TOKEN)],
            ),
        ],
        response_count=3,
    )
    assert responses == [
        Response('connected', []),
        Response('state', [VALID_TOKEN], 'create-request-id'),
        Response('state', [UPDATED_TOKEN], 'move-request-id'),
    ]


async def test_ping(gss: GameStateServer) -> None:
    responses = await collect_responses(
        gss,
        requests=[
            DecoratedRequest(
                'ping-request-id', [PingAction(action='ping', data=VALID_PING)]
            )
        ],
        response_count=3,
    )
    assert responses == [
        Response('connected', []),
        Response('state', [VALID_PING], 'ping-request-id'),
        Response('state', [], 'ping-request-id'),
    ]


async def test_more_tokens_than_colors(gss: GameStateServer) -> None:
    updates = []
    for i in range(len(colors) + 1):
        updates.append(
            CreateOrUpdateAction(
                action='create',
                data=Token(
                    id=f'token{i}',
                    type='character',
                    contents=IconTokenContents('some icon'),
                    start_x=i,
                    start_y=i,
                    start_z=1,
                    end_x=i + 1,
                    end_y=i + 1,
                    end_z=2,
                ),
            )
        )

    responses = await collect_responses(
        gss, requests=[DecoratedRequest('request-id', updates)], response_count=2
    )

    tokens_without_color = []
    for token in responses[1].data:
        assert isinstance(token, Token)
        if not token.color_rgb:
            tokens_without_color.append(token)

    assert len(tokens_without_color) == 1
