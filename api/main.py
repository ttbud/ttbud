import asyncio
import logging
import os
import signal
import socket
import sys
from asyncio import (
    CancelledError,
    Handle,
    Protocol,
    Transport,
)
from asyncio import Future, AbstractEventLoop
from socket import gaierror
from typing import TypedDict, Optional, Any, Dict, cast
from uuid import uuid4

import aiobotocore
import scout_apm.core
import timber
import uvicorn
from aiobotocore.session import ClientCreatorContext
from aiohttp import ClientConnectorError
from botocore.exceptions import ClientError
from scout_apm.api import Config as ScoutConfig
from starlette.applications import Starlette

from src.api.wsmanager import WebsocketManager
from src.compaction import Compactor
from src.config import config, Environment
from src.game_state_server import GameStateServer
from src.rate_limit.noop_rate_limit import NoopRateLimiter
from src.rate_limit.redis_rate_limit import create_redis_rate_limiter
from src.redis import create_redis_pool
from src.room_store.merged_room_store import MergedRoomStore
from src.room_store.redis_room_store import create_redis_room_store
from src.room_store.s3_room_archive import S3RoomArchive
from src.routes import routes
from src.util.async_util import end_task
from src.util.lazy_asgi import LazyASGI

logger = logging.getLogger(__name__)
server_id = str(uuid4())
ScoutConfig.set(**config.scout_config)
scout_apm.core.install()


class ExceptionContext(TypedDict):
    # See:
    # https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.loop.call_exception_handler
    message: str
    exception: Optional[BaseException]
    future: Optional[Future]
    handle: Optional[Handle]
    protocol: Optional[Protocol]
    transport: Optional[Transport]
    socket: Optional[socket.socket]


def create_s3_context() -> ClientCreatorContext:
    s3_client_context = aiobotocore.get_session().create_client(
        's3',
        region_name=config.aws_region,
        endpoint_url=config.aws_endpoint,
        aws_access_key_id=config.aws_key_id,
        aws_secret_access_key=config.aws_secret_key,
    )
    return s3_client_context


async def make_app() -> Starlette:
    shutting_down = False
    worker_id = str(uuid4())
    timber.context(server={'server_id': server_id, 'worker_id': worker_id})

    def exception_handler(_: AbstractEventLoop, context: Dict[str, Any]) -> None:
        ctx = cast(ExceptionContext, context)
        msg = ctx['message']
        exc = ctx.get('exception')
        if shutting_down and isinstance(exc, CancelledError):
            # if we're shutting down all the tasks should be cancelled, so no need to
            # log that or send a sigint
            return

        exc_info = (type(exc), exc, exc.__traceback__) if exc else None
        logger.critical(f'shutting down due to error: {msg}', exc_info=exc_info)
        # sys.exit doesn't work inside a loop exception handler because all exceptions
        # in this method are just swallowed
        os.kill(os.getpid(), signal.SIGINT)

    loop = asyncio.get_running_loop()
    loop.set_exception_handler(exception_handler)

    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    room_store_context = create_redis_room_store(redis)
    redis_room_store = await room_store_context.__aenter__()
    rate_limiter = await create_redis_rate_limiter(server_id, redis)

    s3_client_context = create_s3_context()
    s3_client = await s3_client_context.__aenter__()
    room_archive = S3RoomArchive(s3_client, config.aws_bucket)
    compactor = Compactor(redis_room_store, room_archive, worker_id)

    merged_room_store = MergedRoomStore(redis_room_store, room_archive)
    gss = GameStateServer(merged_room_store, rate_limiter, NoopRateLimiter())
    ws = WebsocketManager(gss, rate_limiter, config.bypass_rate_limit_key)

    liveness_task = asyncio.create_task(
        ws.maintain_liveness(), name='maintain_liveness'
    )
    compactor_task = asyncio.create_task(
        compactor.maintain_compaction(), name='maintain_compaction'
    )

    async def shutdown() -> None:
        nonlocal shutting_down
        shutting_down = True

        await room_store_context.__aexit__(None, None, None)
        await asyncio.gather(
            redis.close(),
            end_task(liveness_task),
            end_task(compactor_task),
        )
        await s3_client_context.__aexit__(None, None, None)

    return Starlette(
        routes=routes(ws),
        on_shutdown=[shutdown],
        debug=config.environment == Environment.DEV,
    )


app = LazyASGI(make_app)


async def wait_for_s3_ready() -> None:
    logger.info("waiting for s3 bucket to exist")
    async with create_s3_context() as client:
        while True:
            try:
                await client.head_bucket(Bucket=config.aws_bucket)
                logger.info("s3 bucket ready")
                break
            except (ClientError, ClientConnectorError):
                pass
            await asyncio.sleep(0.1)


async def wait_for_redis_ready() -> None:
    logger.info("waiting for redis to be ready")
    while True:
        try:
            redis = await create_redis_pool(
                config.redis_address, config.redis_ssl_validation
            )
            logger.info("redis is ready")
            await redis.close()
            break
        except gaierror:
            pass
        await asyncio.sleep(0.1)


MAX_WAIT_TIME_SECS = 60


async def wait_until_services_ready() -> None:
    fut = asyncio.gather(
        wait_for_s3_ready(),
        wait_for_redis_ready(),
    )
    await asyncio.wait_for(fut, timeout=MAX_WAIT_TIME_SECS)


if __name__ == '__main__':
    if config.environment != Environment.DEV:
        logger.critical(
            "Refusing to run in non-development mode, use gunicorn in production"
        )
        sys.exit(1)

    asyncio.run(wait_until_services_ready())
    uvicorn.run(
        'main:app',
        reload=True,
        host='0.0.0.0',
        port=config.websocket_port,
        log_config=config.log_config,
        ssl_keyfile=config.cert_config.key_file_path if config.cert_config else None,
        ssl_certfile=config.cert_config.cert_file_path if config.cert_config else None,
    )
