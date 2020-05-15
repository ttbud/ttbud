import pytest
from dataclasses import asdict

from src.game_state_server import (
    GameStateServer,
    Message,
    MessageContents,
    MAX_USERS_PER_ROOM,
    InvalidConnectionException,
)
from src.room_store import MemoryRoomStore
from src.game_components import Token, Ping
from src.async_collect import async_collect
from src.colors import colors


TEST_ROOM_ID = 'test_room'
TEST_CLIENT_ID = 'test_client'
TEST_REQUEST_ID = 'test_request'
VALID_TOKEN = Token('some_id', 'character', 'some_icon_id', 0, 0, 0, 1, 1, 1, colors[0])
UPDATED_TOKEN = Token(
    VALID_TOKEN.id, VALID_TOKEN.type, VALID_TOKEN.icon_id, 7, 8, 9, 8, 9, 10
)
VALID_UPDATE = {'action': 'create', 'data': asdict(VALID_TOKEN)}
VALID_PING = Ping('ping_id', 'ping', 0, 0)


@pytest.fixture
def gss():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    return GameStateServer(rs)


@pytest.fixture
def gss_with_client():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    gss = GameStateServer(rs)
    gss.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)
    return gss


def test_new_connection(gss):
    reply = gss.new_connection_request('test_client', 'room1')
    assert reply.contents.type == 'connected'
    assert len(reply.contents.data) == 0


@pytest.mark.asyncio
async def test_room_does_not_exist(gss):
    reply = await async_collect(
        gss.process_updates(
            {}, 'room id that does not exist', TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    assert reply[0].contents.type == 'error'


@pytest.mark.asyncio
async def test_room_data_is_stored(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    gss_with_client.connection_dropped(TEST_CLIENT_ID, TEST_ROOM_ID)
    stored_data = gss_with_client.room_store.read_room_data(TEST_ROOM_ID)
    assert asdict(VALID_TOKEN) in stored_data


@pytest.mark.asyncio
async def test_duplicate_update_rejected(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    assert reply[0].contents.type == 'error'
    assert reply[1].contents.type == 'state'
    assert len(reply[1].contents.data) == 1


@pytest.mark.asyncio
async def test_duplicate_update_in_different_room(gss):
    gss.new_connection_request('client1', 'room1')
    gss.new_connection_request('client2', 'room2')
    reply1 = await async_collect(
        gss.process_updates([VALID_UPDATE], 'room1', 'client1', 'request1')
    )
    reply2 = await async_collect(
        gss.process_updates([VALID_UPDATE], 'room2', 'client2', 'request2')
    )
    assert reply1[0].contents.data[0] == VALID_TOKEN
    assert reply2[0].contents.data[0] == VALID_TOKEN


@pytest.mark.asyncio
async def test_delete_token(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'delete', 'data': VALID_TOKEN.id}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert len(reply[0].contents.data) == 0


@pytest.mark.asyncio
async def test_delete_non_existent_token(gss_with_client):
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'delete', 'data': VALID_TOKEN.id}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert reply[0].contents.type == 'error'


@pytest.mark.asyncio
async def test_delete_after_load(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    gss_with_client.connection_dropped(TEST_CLIENT_ID, TEST_ROOM_ID)
    gss_with_client.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'delete', 'data': VALID_TOKEN.id}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert len(reply[0].contents.data) == 0


@pytest.mark.asyncio
async def test_move_existing_token(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'update', 'data': asdict(UPDATED_TOKEN)}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert reply[0].contents.data == [UPDATED_TOKEN]


@pytest.mark.asyncio
async def test_ping(gss_with_client, mocker):
    mocker.patch('asyncio.sleep')
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'ping', 'data': asdict(VALID_PING)}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    assert reply[0].contents.type == 'state'
    assert reply[0].contents.data == [VALID_PING]


@pytest.mark.asyncio
async def test_invalid_action(gss_with_client):
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'destroy all humans', 'data': VALID_TOKEN}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    # FIXME: Brittle
    assert reply == [
        Message(
            {TEST_CLIENT_ID},
            MessageContents(
                'error', 'Invalid action: destroy all humans', TEST_REQUEST_ID
            ),
        ),
        Message({TEST_CLIENT_ID}, MessageContents('state', [], TEST_REQUEST_ID)),
    ]


@pytest.mark.asyncio
async def test_invalid_data(gss_with_client):
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'create', 'data': 'destroy all humans'}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    # FIXME: Brittle
    assert reply == [
        Message(
            {TEST_CLIENT_ID},
            MessageContents(
                'error', 'Received bad token: destroy all humans', TEST_REQUEST_ID
            ),
        ),
        Message({TEST_CLIENT_ID}, MessageContents('state', [], TEST_REQUEST_ID)),
    ]


@pytest.mark.asyncio
async def test_incomplete_message(gss_with_client):
    reply1 = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'create'}], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply2 = await async_collect(
        gss_with_client.process_updates(
            [{'data': asdict(VALID_TOKEN)}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    # FIXME: Brittle
    expected_reply = [
        Message(
            {TEST_CLIENT_ID},
            MessageContents('error', 'Did not receive a full update', TEST_REQUEST_ID),
        ),
        Message({TEST_CLIENT_ID}, MessageContents('state', [], TEST_REQUEST_ID)),
    ]
    assert reply1 == expected_reply
    assert reply2 == expected_reply


@pytest.mark.asyncio
async def test_delete_with_full_token(gss_with_client):
    await async_collect(
        gss_with_client.process_updates(
            [VALID_UPDATE], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'delete', 'data': asdict(VALID_TOKEN)}],
            TEST_ROOM_ID,
            TEST_CLIENT_ID,
            TEST_REQUEST_ID,
        )
    )
    # FIXME: Brittle
    assert reply == [
        Message(
            {TEST_CLIENT_ID},
            MessageContents(
                'error', 'Data for delete actions must be a token ID', TEST_REQUEST_ID
            ),
        ),
        Message(
            {TEST_CLIENT_ID}, MessageContents('state', [VALID_TOKEN], TEST_REQUEST_ID)
        ),
    ]


@pytest.mark.asyncio
async def test_room_full(gss_with_client):
    for i in range(MAX_USERS_PER_ROOM):
        gss_with_client.new_connection_request(f'client{i}', TEST_ROOM_ID)

    with pytest.raises(InvalidConnectionException):
        gss_with_client.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)


@pytest.mark.asyncio
async def test_more_icons_than_colors(gss_with_client):
    for i in range(len(colors) + 1):
        update = {
            'action': 'create',
            'data': {
                'id': f'token{i}',
                'type': 'character',
                'icon_id': 'some_icon',
                'start_x': i,
                'start_y': i,
                'start_z': 1,
                'end_x': i + 1,
                'end_y': i + 1,
                'end_z': 2,
            }
        }
        await async_collect(gss_with_client.process_updates(
            [update], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        ))
