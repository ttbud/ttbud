import os
import sched
import time

from wsmanager import start_websocket
from room_store import FileRoomStore
from game_state_server import GameStateServer


def main():
    websocket_port = int(os.environ['API_WEBSOCKET_PORT'])
    room_store_dir = os.environ['ROOM_STORE_DIR']

    room_store = FileRoomStore(room_store_dir)
    ping_remover = sched.scheduler()
    gss = GameStateServer(room_store, ping_remover)

    start_websocket(websocket_port, gss)


if __name__ == '__main__':
    main()
