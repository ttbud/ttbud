import pytest

from game_state_server import GameStateServer, MessageError
from room_store import MemoryRoomStore


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
