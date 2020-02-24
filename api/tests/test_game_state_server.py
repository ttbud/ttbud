import pytest
from dataclasses import asdict

from game_state_server import GameStateServer, Message, MessageContents
from room_store import MemoryRoomStore
from game_components import Token, Ping
from async_collect import async_collect


TEST_ROOM_ID = 'test_room'
TEST_CLIENT_ID = 'test_client'
TEST_REQUEST_ID = 'test_request'
VALID_TOKEN = Token('some_id', 'character', 'some_icon_id', 0, 0, 0, 1, 1, 1)
UPDATED_TOKEN = Token(VALID_TOKEN.id, VALID_TOKEN.type, VALID_TOKEN.icon_id, 7, 8, 9, 8, 9, 10)
valid_update = {'action': 'create', 'data': asdict(VALID_TOKEN)}
valid_ping = {
    'action': 'ping',
    'data': {'id': 'ping_id', 'type': 'ping', 'x': 0, 'y': 0},
}


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
    reply = await async_collect(gss.process_updates({}, 'room id that does not exist', TEST_CLIENT_ID, TEST_REQUEST_ID))
    assert reply[0].contents.type == 'error'


@pytest.mark.asyncio
async def test_room_data_is_stored(gss_with_client):
    await async_collect(gss_with_client.process_updates([valid_update], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID))
    gss_with_client.connection_dropped(TEST_CLIENT_ID, TEST_ROOM_ID)
    stored_data = gss_with_client.room_store.read_room_data(TEST_ROOM_ID)
    assert stored_data[VALID_TOKEN.id] == VALID_TOKEN


@pytest.mark.asyncio
async def test_duplicate_update_rejected(gss_with_client):
    await async_collect(gss_with_client.process_updates([valid_update], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID))
    reply = await async_collect(gss_with_client.process_updates([valid_update], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID))
    assert reply[0].contents.type == 'error'
    assert reply[1].contents.type == 'state'
    assert len(reply[1].contents.data) == 1


@pytest.mark.asyncio
async def test_duplicate_update_in_different_room(gss):
    gss.new_connection_request('client1', 'room1')
    gss.new_connection_request('client2', 'room2')
    reply1 = await async_collect(gss.process_updates([valid_update], 'room1', 'client1', 'request1'))
    reply2 = await async_collect(gss.process_updates([valid_update], 'room2', 'client2', 'request2'))
    assert reply1[0].contents.data[0] == VALID_TOKEN
    assert reply2[0].contents.data[0] == VALID_TOKEN


@pytest.mark.asyncio
async def test_delete_token(gss_with_client):
    await async_collect(gss_with_client.process_updates([valid_update], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID))
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'delete', 'data': VALID_TOKEN.id}], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        )
    )
    assert len(reply[0].contents.data) == 0


@pytest.mark.asyncio
async def test_delete_non_existent_token(gss_with_client):
    reply = await async_collect(
        gss_with_client.process_updates(
            [{'action': 'delete', 'data': VALID_TOKEN.id}], TEST_ROOM_ID, TEST_CLIENT_ID, TEST_REQUEST_ID
        ))
    assert reply[0].contents.type == 'error'


@pytest.mark.asyncio
async def test_delete_after_load(gss_with_client):
    await async_collect(gss_with_client.process_updates(valid_update, TEST_ROOM_ID))
    gss_with_client.connection_dropped(TEST_CLIENT_ID, TEST_ROOM_ID)
    gss_with_client.new_connection_request(TEST_CLIENT_ID, TEST_ROOM_ID)
    reply = await async_collect(
        gss_with_client.process_updates(
            {'action': 'delete', 'data': VALID_TOKEN.id}, TEST_ROOM_ID,
        )
    )
    assert len(reply[0].data) == 0


@pytest.mark.asyncio
async def test_move_existing_token(gss_with_client):
    await async_collect(gss_with_client.process_updates(valid_update, TEST_ROOM_ID))
    reply = await async_collect(
        gss_with_client.process_updates(
            {'action': 'update', 'data': UPDATED_TOKEN}, TEST_ROOM_ID
        )
    )
    assert len(reply[0].data) == 1
    assert reply[0].data[0] == UPDATED_TOKEN


@pytest.mark.asyncio
async def test_ping(gss_with_client, mocker):
    mocker.patch('asyncio.sleep')
    reply = await async_collect(
        gss_with_client.process_updates(valid_ping, TEST_ROOM_ID)
    )
    assert reply[0].type == 'state'
    assert len(reply[0].data) == 1
    assert reply[0].data[0] == valid_ping['data']


@pytest.mark.asyncio
async def test_invalid_action(gss_with_client):
    with pytest.raises(MessageError):
        await async_collect(
            gss_with_client.process_updates(
                {'action': 'destroy all humans', 'data': VALID_TOKEN}, TEST_ROOM_ID
            )
        )


@pytest.mark.asyncio
async def test_invalid_data(gss_with_client):
    with pytest.raises(MessageError):
        await async_collect(
            gss_with_client.process_updates(
                {'action': 'create', 'data': 'destroy all humans'}, TEST_ROOM_ID
            )
        )


@pytest.mark.asyncio
async def test_incomplete_message(gss_with_client):
    with pytest.raises(MessageError):
        await async_collect(
            gss_with_client.process_updates({'action': 'create'}, TEST_ROOM_ID)
        )
    with pytest.raises(MessageError):
        await async_collect(
            gss_with_client.process_updates({'data': VALID_TOKEN}, TEST_ROOM_ID)
        )


@pytest.mark.asyncio
async def test_delete_with_full_token(gss_with_client):
    await async_collect(gss_with_client.process_updates(valid_update, TEST_ROOM_ID))
    with pytest.raises(MessageError):
        await async_collect(
            gss_with_client.process_updates(
                {'action': 'delete', 'data': VALID_TOKEN}, TEST_ROOM_ID
            )
        )
