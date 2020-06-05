import signal
import logging.config

from src.config import room_store_dir, websocket_port, log_config
from src.wsmanager import start_websocket
from src.room_store import FileRoomStore
from src.game_state_server import GameStateServer


def main():
    logging.config.dictConfig(log_config)

    room_store = FileRoomStore(room_store_dir)
    gss = GameStateServer(room_store)

    signal.signal(signal.SIGTERM, lambda *_: gss.save_all())
    start_websocket(websocket_port, gss)


if __name__ == '__main__':
    main()
