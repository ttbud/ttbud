import signal
import asyncio
import logging.config

import scout_apm.api

from src import apm
from src.config import config
from src.wsmanager import WebsocketManager
from src.room_store import DatabaseRoomStore
from src.game_state_server import GameStateServer


async def start_server():
    room_store = await DatabaseRoomStore.obtain(config.db_address)
    gss = GameStateServer(room_store)
    ws = WebsocketManager(config.websocket_port, gss)
    await ws.start_websocket()
    return gss


def main():
    logging.config.dictConfig(config.log_config)
    scout_apm.api.install(config=config.scout_config)

    loop = asyncio.get_event_loop()
    gss = loop.run_until_complete(start_server())
    loop.add_signal_handler(
        signal.SIGTERM, lambda *_: loop.run_until_complete(gss.save_all())
    )
    loop.run_forever()


if __name__ == '__main__':
    main()
