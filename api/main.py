import asyncio
import logging
import sys
from asyncio import Future
from typing import NoReturn
from uuid import uuid4

import timber
import uvicorn
from starlette.applications import Starlette

from compaction import Compactor
from src import apm
from src.api.wsmanager import WebsocketManager
from src.config import config, Environment
from src.game_state_server import GameStateServer
from src.rate_limit.redis_rate_limit import create_redis_rate_limiter
from src.redis import create_redis_pool
from src.room_store.redis_room_store import create_redis_room_store
from src.routes import routes
from src.util.lazy_asgi import LazyASGI

logger = logging.getLogger(__name__)
server_id = str(uuid4())


async def make_app() -> Starlette:
    worker_id = str(uuid4())
    timber.context(server={'server_id': server_id, 'worker_id': worker_id})

    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    room_store = await create_redis_room_store(redis)
    rate_limiter = await create_redis_rate_limiter(server_id, redis)

    compactor = Compactor(room_store)

    gss = GameStateServer(room_store, apm.transaction, rate_limiter)
    ws = WebsocketManager(gss, rate_limiter)

    def liveness_failed(fut: Future) -> NoReturn:
        logger.critical(
            'Maintain liveness task failed, shutting down', exc_info=fut.exception()
        )
        sys.exit(1)

    liveness_task = asyncio.create_task(
        ws.maintain_liveness(), name='maintain_liveness'
    )
    liveness_task.add_done_callback(liveness_failed)

    def compaction_failed(fut: Future) -> NoReturn:
        logger.critical(
            'Compaction task failed, shutting down', exc_info=fut.exception()
        )
        sys.exit(1)

    compaction_task = asyncio.create_task(
        compactor.maintain_compaction(), name='maintain_compaction'
    )
    compaction_task.add_done_callback(compaction_failed)

    async def shutdown() -> None:
        redis.close()
        await redis.wait_closed()

    return Starlette(
        routes=routes(ws),
        on_shutdown=[shutdown],
        debug=config.environment == Environment.DEV,
    )


app = LazyASGI(make_app)

if __name__ == '__main__':
    uvicorn.run(
        'main:app',
        reload=True,
        host='0.0.0.0',
        port=config.websocket_port,
        log_config=config.log_config,
        ssl_keyfile=config.cert_config.key_file_path if config.cert_config else None,
        ssl_certfile=config.cert_config.cert_file_path if config.cert_config else None,
    )
