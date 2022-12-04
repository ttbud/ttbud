import asyncio
import contextlib
import json
from asyncio import Future, Task
from collections import defaultdict
from dataclasses import dataclass, asdict
from json import JSONDecodeError
from typing import Optional, DefaultDict, List, Union, NoReturn, Literal, AsyncIterator

from dacite import from_dict, DaciteError
from redis.asyncio.client import Redis, PubSub

from src.api.api_structures import Request
from src.util.async_util import end_task

# Heroku will close an inactive connection after 300 seconds
# https://devcenter.heroku.com/articles/heroku-redis#timeout
KEEPALIVE_INTERVAL_SECS = 60


def _channel_key(room_id: str) -> str:
    return f'channel:{room_id}'


@dataclass
class _PubSubMessage:
    type: Literal['message']
    channel: bytes
    data: bytes


class RedisRoomListener:
    def __init__(self, redis: Redis, pubsub: PubSub):
        self._redis = redis
        self._pubsub = pubsub
        self._listening_started: Future[None] = Future()
        self._pubsub_task: Optional[Task] = None
        self._keepalive_task: Optional[Task] = None
        self._queues_by_room_id: DefaultDict[
            str, List[asyncio.Queue[Union[Request, BaseException]]]
        ] = defaultdict(list)

    async def reset(self) -> None:
        self._listening_started.cancel("Resetting RedisRoomStore")
        self._listening_started = asyncio.Future()
        if self._pubsub_task:
            self._pubsub_task.cancel("Resetting RedisRoomStore")
            await end_task(self._pubsub_task)

        if self._keepalive_task:
            self._keepalive_task.cancel("Resetting RedisRoomStore")
            await end_task(self._keepalive_task)

    async def publish(
        self, room_id: str, request: Request, pipeline: Optional[Redis] = None
    ) -> None:
        con = pipeline or self._redis
        await con.publish(_channel_key(room_id), json.dumps(asdict(request)))

    async def _keep_connection_alive(self) -> NoReturn:
        while True:
            await asyncio.sleep(KEEPALIVE_INTERVAL_SECS)
            await self._pubsub.ping()

    def _on_pubsub_task_finished(self, task: Task) -> None:
        exc = task.exception() or ValueError(
            f'{task.get_name()} finished without throwing an exception'
        )
        for queues in self._queues_by_room_id.values():
            for q in queues:
                # put_nowait will not throw here because we use unbounded queues
                q.put_nowait(exc)

    def _listening_for_changes(self) -> bool:
        return bool(self._pubsub_task and self._keepalive_task)

    def _listen_for_changes(self) -> None:
        self._keepalive_task = asyncio.create_task(
            self._keep_connection_alive(), name='RedisRoomStore keepalive'
        )
        self._pubsub_task = asyncio.create_task(
            self._announce_changes(), name='RedisRoomStore pubsub'
        )
        self._keepalive_task.add_done_callback(self._on_pubsub_task_finished)
        self._pubsub_task.add_done_callback(self._on_pubsub_task_finished)

    async def _announce_changes(self) -> NoReturn:
        self._listening_started.set_result(None)
        while True:
            resp = await self._pubsub.parse_response(block=True)
            # Sometimes when shutting down the connection, parse_response returns an
            # empty byte array, which handle_message cannot handle (ironically)
            if not resp:
                continue
            raw_event = await self._pubsub.handle_message(resp)
            if raw_event is None or raw_event['type'] != 'message':
                continue

            event = from_dict(_PubSubMessage, raw_event)
            room_id = event.channel.decode().removeprefix('channel:')
            if room_id not in self._queues_by_room_id:
                # No one's listening anymore, just skip this one
                continue

            update: Union[Request, BaseException]
            try:
                update = from_dict(Request, json.loads(event.data.decode()))
            except (DaciteError, JSONDecodeError) as e:
                update = e
            for q in self._queues_by_room_id[room_id]:
                await q.put(update)

    async def changes(self, room_id: str) -> AsyncIterator[Request]:
        queue: asyncio.Queue[Union[Request, BaseException]] = asyncio.Queue()
        self._queues_by_room_id[room_id].append(queue)
        # If we're the first listener for this room, subscribe to updates from redis
        if len(self._queues_by_room_id[room_id]) == 1:
            await self._pubsub.subscribe(_channel_key(room_id))

        if not self._listening_for_changes():
            self._listen_for_changes()

        await self._listening_started

        return self._room_changes(room_id, queue)

    async def _room_changes(
        self, room_id: str, queue: asyncio.Queue[Union[Request, BaseException]]
    ) -> AsyncIterator[Request]:
        try:
            while True:
                item = await queue.get()
                if isinstance(item, Request):
                    yield item
                else:
                    raise item
        finally:
            self._queues_by_room_id[room_id].remove(queue)
            if not self._queues_by_room_id[room_id]:
                del self._queues_by_room_id[room_id]
                await self._pubsub.unsubscribe(_channel_key(room_id))


@contextlib.asynccontextmanager
async def create_redis_room_listener(redis: Redis) -> AsyncIterator[RedisRoomListener]:
    async with redis.pubsub() as pubsub:
        listener = RedisRoomListener(redis, pubsub)
        try:
            yield listener
        finally:
            await pubsub.reset()
            await listener.reset()
