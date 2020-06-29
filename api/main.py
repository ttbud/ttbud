import signal
import asyncio
import logging.config
import ssl
from typing import Optional
from uuid import uuid4

import scout_apm.api
import timber

from src import apm
from src.config import config
from src.rate_limit import (
    RateLimiter,
    create_redis_rate_limiter,
)
from src.redis import create_redis_pool
from src.wsmanager import WebsocketManager
from src.room_store import RedisRoomStore, RoomStore
from src.game_state_server import GameStateServer


async def start_server(server_id: str) -> GameStateServer:
    room_store: RoomStore
    rate_limiter: RateLimiter
    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    room_store = RedisRoomStore(redis)
    rate_limiter = await create_redis_rate_limiter(server_id, redis)

    gss = GameStateServer(room_store, apm.transaction)
    ws = WebsocketManager(config.websocket_port, gss, rate_limiter)

    ssl_context: Optional[ssl.SSLContext]
    if config.cert_config:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(
            keyfile=config.cert_config.key_file_path,
            certfile=config.cert_config.cert_file_path,
        )
    else:
        ssl_context = None
    await ws.start_websocket(ssl=ssl_context)
    return gss


def main() -> None:
    server_id = str(uuid4())
    logging.config.dictConfig(config.log_config)
    scout_apm.api.install(config=config.scout_config)

    with timber.context(server={'server_id': server_id}):
        loop = asyncio.get_event_loop()
        gss = loop.run_until_complete(start_server(server_id))
        loop.add_signal_handler(
            signal.SIGTERM, lambda *_: loop.run_until_complete(gss.save_all())
        )
        loop.run_forever()


if __name__ == '__main__':
    main()
