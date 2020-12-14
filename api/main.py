import asyncio
import logging.config
import ssl
import signal
from typing import Optional
from uuid import uuid4

import scout_apm.api
import timber

from src import apm
from src.config import config
from src.rate_limit.redis_rate_limit import create_redis_rate_limiter

from src.redis import create_redis_pool
from src.api.wsmanager import WebsocketManager
from src.game_state_server import GameStateServer
from src.room_store.redis_room_store import create_redis_room_store


async def start_server(server_id: str) -> None:
    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    room_store = await create_redis_room_store(redis)
    rate_limiter = await create_redis_rate_limiter(server_id, redis)

    gss = GameStateServer(room_store, apm.transaction, rate_limiter)
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

    stop: asyncio.Future[None] = asyncio.Future()
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGINT, stop.set_result, None)
    loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)

    await ws.listen(stop, ssl=ssl_context)
    redis.close()
    await redis.wait_closed()


def main() -> None:
    server_id = str(uuid4())
    logging.config.dictConfig(config.log_config)
    scout_apm.api.install(config=config.scout_config)

    with timber.context(server={'server_id': server_id}):
        asyncio.run(start_server(server_id))


if __name__ == '__main__':
    main()
