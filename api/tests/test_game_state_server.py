import pytest

from game_state_server import GameStateServer, MessageError, Token
from room_store import MemoryRoomStore


TEST_ROOM_ID = 'test_room'
TEST_CLIENT = 'test_client'
valid_data = {
    'id': 'some_id',
    'icon_id': 'some_icon_id',
    'start_x': 0,
    'start_y': 0,
    'start_z': 0,
    'end_x': 1,
    'end_y': 1,
    'end_z': 1,
}
valid_update = {'action': 'create', 'data': valid_data}


@pytest.fixture
def set_up_gss():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    return GameStateServer(rs)


@pytest.fixture
def set_up_gss_with_client():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    gss = GameStateServer(rs)
    gss.new_connection_request(TEST_CLIENT, TEST_ROOM_ID)
    return gss


def test_new_connection(set_up_gss):
    gss = set_up_gss
    reply = gss.new_connection_request('test_client', 'room1')
    assert reply.type == 'state'
    assert len(reply.data) == 0


def test_room_does_not_exist(set_up_gss):
    gss = set_up_gss
    with pytest.raises(MessageError):
        gss.process_update({}, 'room id that does not exist')


def test_room_data_is_stored(set_up_gss_with_client):
    gss = set_up_gss_with_client
    gss.process_update(valid_update, TEST_ROOM_ID)
    gss.connection_dropped(TEST_CLIENT, TEST_ROOM_ID)
    assert gss.room_store.stored_data.get(TEST_ROOM_ID, False)
    assert gss.room_store.stored_data[TEST_ROOM_ID].get(valid_data['id'], False)
    assert gss.room_store.stored_data[TEST_ROOM_ID][valid_data['id']] == valid_data


def test_duplicate_update_rejected(set_up_gss_with_client):
    gss = set_up_gss_with_client
    gss.process_update(valid_update, TEST_ROOM_ID)
    with pytest.raises(MessageError):
        gss.process_update(valid_update, TEST_ROOM_ID)


def test_duplicate_update_in_different_room(set_up_gss):
    gss = set_up_gss
    gss.new_connection_request('client1', 'room1')
    gss.new_connection_request('client2', 'room2')
    gss.process_update(valid_update, 'room1')
    gss.process_update(valid_update, 'room2')


def test_delete_token(set_up_gss_with_client):
    gss = set_up_gss_with_client
    gss.process_update(valid_update, TEST_ROOM_ID)
    reply = gss.process_update(
        {'action': 'delete', 'data': valid_data['id']}, TEST_ROOM_ID
    )
    assert len(reply.data) == 0


def test_delete_non_existent_token(set_up_gss_with_client):
    gss = set_up_gss_with_client
    with pytest.raises(MessageError):
        gss.process_update({'action': 'delete', 'data': valid_data['id']}, TEST_ROOM_ID)
