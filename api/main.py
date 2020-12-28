import logging
from uuid import uuid4

import timber
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute

from src import apm
from src.api.wsmanager import WebsocketManager
from src.config import config, Environment
from src.game_state_server import GameStateServer
from src.gunicorn_config import gunicorn_config
from src.rate_limit.redis_rate_limit import create_redis_rate_limiter
from src.redis import create_redis_pool
from src.room_store.redis_room_store import create_redis_room_store
from src.util.lazy_app import LazyApp
from src.ws.starlette_ws_client import StarletteWebsocketClient

logger = logging.getLogger(__name__)
server_id = str(uuid4())


async def make_app() -> Starlette:
    worker_id = str(uuid4())
    timber.context(server={'server_id': server_id, 'worker_id': worker_id})

    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    room_store = await create_redis_room_store(redis)
    rate_limiter = await create_redis_rate_limiter(server_id, redis)

    gss = GameStateServer(room_store, apm.transaction, rate_limiter)
    ws = WebsocketManager(config.websocket_port, gss, rate_limiter)
    routes = [
        WebSocketRoute(
            '/{room_id}',
            lambda websocket: ws.connection_handler(
                StarletteWebsocketClient(websocket)
            ),
        )
    ]

    async def shutdown() -> None:
        redis.close()
        await redis.wait_closed()

    return Starlette(
        routes=routes,
        on_shutdown=[shutdown],
        debug=config.environment == Environment.DEV,
    )


if __name__ == '__main__':
    LazyApp(make_app, gunicorn_config).run()
