import signal
import asyncio
import logging.config
from uuid import uuid4

import scout_apm.api
import timber

from src import apm
from src.config import config
from src.rate_limit import (
    RateLimiter,
    MemoryRateLimiter,
    MemoryRateLimiterStorage,
    create_redis_rate_limiter,
)
from src.redis import create_redis_pool
from src.wsmanager import WebsocketManager
from src.room_store import RedisRoomStore, FileRoomStore, RoomStore
from src.game_state_server import GameStateServer


async def start_server(server_id: str) -> GameStateServer:
    room_store: RoomStore
    rate_limiter: RateLimiter
    if config.use_redis:
        redis = await create_redis_pool(
            config.redis_address, config.redis_ssl_validation
        )
        room_store = RedisRoomStore(redis)
        rate_limiter = await create_redis_rate_limiter(server_id, redis)
    else:
        room_store = FileRoomStore(config.room_store_dir)
        rate_limiter = MemoryRateLimiter(server_id, MemoryRateLimiterStorage())

    gss = GameStateServer(room_store, apm.transaction)
    ws = WebsocketManager(config.websocket_port, gss, rate_limiter)
    await ws.start_websocket()
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
