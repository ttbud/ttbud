import pytest
from dataclasses import asdict

from tests.helpers import assert_matches, assert_all_match
from src.game_state_server import (
    GameStateServer,
    MAX_USERS_PER_ROOM,
    InvalidConnectionException,
    Message,
)
from src.api_structures import Response, CreateOrUpdateAction, DeleteAction, PingAction
from src.room_store import MemoryRoomStore
from src.game_components import Token, Ping, IconTokenContents
from src.async_collect import async_collect
from src.colors import colors
from tests.fake_apm import fake_transaction


TEST_ROOM_ID = 'test_room'
TEST_CLIENT_ID = 'test_client'
TEST_REQUEST_ID = 'test_request'
BAD_REQUEST_ID = 'bad_request'
VALID_TOKEN = Token(
    'some_id',
    'character',
    IconTokenContents('some_icon_id'),
    0,
    0,
    0,
    1,
    1,
    1,
    colors[0],
)
UPDATED_TOKEN = Token(
    VALID_TOKEN.id, VALID_TOKEN.type, VALID_TOKEN.contents, 7, 8, 9, 8, 9, 10
)
VALID_ACTION = CreateOrUpdateAction(action="create", data=VALID_TOKEN)
VALID_PING = Ping('ping_id', 'ping', 0, 0)


@pytest.fixture
def gss():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    return GameStateServer(rs, fake_transaction)


@pytest.fixture
async def gss_with_client(gss):
    await gss.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)
    return gss


@pytest.mark.asyncio
async def test_new_connection(gss):
    reply = await gss.new_connection_request('test_client', 'room1')
    assert_matches(reply, {'contents': {'type': 'connected', 'data': []}})


@pytest.mark.asyncio
async def test_room_does_not_exist(gss):
    reply = await async_collect(
        gss.process_updates(
            {}, 'room id that does not exist', TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    assert_all_match(reply, [{'contents': {'type': 'error'}}])


@pytest.mark.asyncio
async def test_room_data_is_stored(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    await gss_with_client.connection_dropped(TEST_CLIENT_ID, TEST_ROOM_ID)
    stored_data = await gss_with_client.room_store.read_room_data(TEST_ROOM_ID)
    assert stored_data
    assert asdict(VALID_TOKEN) in stored_data


@pytest.mark.asyncio
async def test_duplicate_update_rejected(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    assert_all_match(
        reply,
        [
            {'contents': {'type': 'error'}},
            {'contents': {'type': 'state', 'data': [VALID_TOKEN]}},
        ],
    )


@pytest.mark.asyncio
async def test_duplicate_update_in_different_room(gss):
    await gss.new_connection_request('client1', 'room1')
    await gss.new_connection_request('client2', 'room2')
    reply1 = await async_collect(
        gss.process_updates([VALID_ACTION], 'room1', 'client1', 'request1')
    )
    reply2 = await async_collect(
        gss.process_updates([VALID_ACTION], 'room2', 'client2', 'request2')
    )
    assert_all_match(
        reply1,
        [
            {
                'targets': ['client1'],
                'contents': {
                    'type': 'state',
                    'data': [VALID_TOKEN],
                    'request_id': 'request1',
                },
            }
        ],
    )
    assert_all_match(
        reply2,
        [
            {
                'targets': {'client2'},
                'contents': {
                    'type': 'state',
                    'data': [VALID_TOKEN],
                    'request_id': 'request2',
                },
            }
        ],
    )


@pytest.mark.asyncio
async def test_update_in_occupied_position(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    other_valid_token = Token(
        'some_other_id',
        'character',
        IconTokenContents('some_other_icon_id'),
        0,
        0,
        0,
        1,
        1,
        1,
        colors[0],
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [CreateOrUpdateAction(action='create', data=other_valid_token)],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            BAD_REQUEST_ID,
        )
    )
    assert_all_match(
        reply,
        [
            {'contents': {'type': 'error', 'request_id': BAD_REQUEST_ID}},
            {
                'contents': {
                    'type': 'state',
                    'data': [VALID_TOKEN],
                    'request_id': BAD_REQUEST_ID,
                }
            },
        ],
    )


@pytest.mark.asyncio
async def test_delete_token(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [DeleteAction(action="delete", data=VALID_TOKEN.id)],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert_all_match(
        reply,
        [{'contents': {'type': 'state', 'data': [], 'request_id': TEST_REQUEST_ID}}],
    )


@pytest.mark.asyncio
async def test_delete_non_existent_token(gss_with_client):
    reply = await async_collect(
        gss_with_client.process_updates(
            [DeleteAction(action="delete", data=VALID_TOKEN.id)],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert_all_match(
        reply, [{'contents': {'type': 'error'}}, {'contents': {'type': 'state'}}]
    )


@pytest.mark.asyncio
async def test_delete_after_reload(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, 'initial_request_id'
        )
    )
    await gss_with_client.connection_dropped(TEST_CLIENT_ID, TEST_ROOM_ID)
    await gss_with_client.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)
    reply = await async_collect(
        gss_with_client.process_updates(
            [DeleteAction(action="delete", data=VALID_TOKEN.id)],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert_all_match(
        reply,
        [{'contents': {'type': 'state', 'data': [], 'request_id': TEST_REQUEST_ID}}],
    )


@pytest.mark.asyncio
async def test_move_existing_token(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_ACTION], TEST_ROOM_ID, TEST_CLIENT_ID, 'initial_request_id'
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [CreateOrUpdateAction(action="update", data=UPDATED_TOKEN)],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert_all_match(reply, [{'contents': {'type': 'state', 'data': [UPDATED_TOKEN]}}])


@pytest.mark.asyncio
async def test_ping(gss_with_client, mocker):
    mocker.patch('asyncio.sleep')
    reply = await async_collect(
        gss_with_client.process_updates(
            [PingAction(action="ping", data=VALID_PING)],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert_all_match(
        reply,
        [
            {'contents': {'type': 'state', 'data': [VALID_PING]}},
            {'contents': {'type': 'state', 'data': []}},
        ],
    )


@pytest.mark.asyncio
async def test_room_full(gss_with_client):
    for i in range(MAX_USERS_PER_ROOM):
        await gss_with_client.new_connection_request(f'client{i}', TEST_ROOM_ID)

    with pytest.raises(InvalidConnectionException):
        await gss_with_client.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)


@pytest.mark.asyncio
async def test_more_tokens_than_colors(gss_with_client):
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

    reply = await async_collect(
        gss_with_client.process_updates(
            updates, TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    tokens_without_color = []
    for token in reply[0].contents.data:
        assert isinstance(token, Token)
        if not token.color_rgb:
            tokens_without_color.append(token)
    assert len(tokens_without_color) == 1
