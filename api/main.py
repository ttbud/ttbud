import signal
import logging.config

import scout_apm.api

from src import apm
from src.config import config
from src.wsmanager import start_websocket
from src.room_store import FileRoomStore
from src.game_state_server import GameStateServer


def main():
    logging.config.dictConfig(config.log_config)
    scout_apm.api.install(config=config.scout_config)

    room_store = FileRoomStore(config.room_store_dir)
    gss = GameStateServer(room_store, apm.transaction)

    signal.signal(signal.SIGTERM, lambda *_: gss.save_all())
    start_websocket(config.websocket_port, gss)


if __name__ == '__main__':
    main()
