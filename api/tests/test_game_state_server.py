from game_state_server import GameStateServer, Token
from room_store import RoomStore


class FakeRoomStore(RoomStore):
    # Don't call super constructor so we don't actually make the directory
    # noinspection PyMissingConstructor
    def __init__(self, room_store_dir):
        self.path = room_store_dir

    def get_all_room_ids(self) -> list:
        return []


def test_new_connection():
    rs = FakeRoomStore('/my/path/to/rooms/')
    gss = GameStateServer(rs)
    reply = gss.new_connection_request('test_client', 'room1')
    assert reply.type == 'state'
    assert len(reply.data) == 0
