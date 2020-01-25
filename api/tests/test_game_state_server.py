import pytest

from game_state_server import GameStateServer, Token, MessageError
from room_store import RoomStore


class FakeRoomStore(RoomStore):
    # Don't call super constructor so we don't actually make the directory
    # noinspection PyMissingConstructor
    def __init__(self, room_store_dir):
        self.path = room_store_dir
        self.stored_data = {}

    def get_all_room_ids(self) -> list:
        return list(self.stored_data.keys())

    def write_room_data(self, room_id: str, data: dict):
        self.stored_data[room_id] = data

    def read_room_data(self, room_id: str) -> dict:
        return self.stored_data[room_id]

    def room_data_exists(self, room_id: str) -> bool:
        return room_id in self.stored_data.keys()


def test_new_connection():
    rs = FakeRoomStore('/my/path/to/rooms/')
    gss = GameStateServer(rs)
    reply = gss.new_connection_request('test_client', 'room1')
    assert reply.type == 'state'
    assert len(reply.data) == 0


def test_room_does_not_exist():
    rs = FakeRoomStore('/my/path/to/rooms/')
    gss = GameStateServer(rs)
    with pytest.raises(MessageError):
        gss.process_update({}, 'room id that does not exist')
