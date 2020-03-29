import os
import signal

from src.wsmanager import start_websocket
from src.room_store import FileRoomStore
from src.game_state_server import GameStateServer


def main():
    websocket_port = int(os.environ['API_WEBSOCKET_PORT'])
    room_store_dir = os.environ['ROOM_STORE_DIR']

    room_store = FileRoomStore(room_store_dir)
    gss = GameStateServer(room_store)

    signal.signal(signal.SIGTERM, lambda *_: gss.save_all())
    start_websocket(websocket_port, gss)


if __name__ == '__main__':
    main()
