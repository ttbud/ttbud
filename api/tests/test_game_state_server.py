import pytest

from game_state_server import GameStateServer, MessageError, Token
from room_store import MemoryRoomStore


valid_data = {'id': 'some_id',
              'icon_id': 'some_icon_id',
              'start_x': 0,
              'start_y': 0,
              'start_z': 0,
              'end_x': 1,
              'end_y': 1,
              'end_z': 1,
              }


def test_new_connection():
    rs = MemoryRoomStore('/my/path/to/rooms/')
    gss = GameStateServer(rs)
    reply = gss.new_connection_request('test_client', 'room1')
    assert reply.type == 'state'
    assert len(reply.data) == 0


def test_room_does_not_exist():
    rs = MemoryRoomStore('/my/path/to/rooms/')
    gss = GameStateServer(rs)
    with pytest.raises(MessageError):
        gss.process_update({}, 'room id that does not exist')


def test_room_data_is_stored():
    rs = MemoryRoomStore('/my/path/to/rooms/')
    gss = GameStateServer(rs)
    gss.new_connection_request('client1', 'room1')
    gss.process_update({
        'action': 'create',
        'data': valid_data,
    }, 'room1')
    gss.connection_dropped('client1', 'room1')
    assert gss.room_store.stored_data.get('room1', False)
    assert gss.room_store.stored_data['room1'].get(valid_data['id'], False)
    assert gss.room_store.stored_data['room1'][valid_data['id']] == valid_data
