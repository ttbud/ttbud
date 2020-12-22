from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import asdict, dataclass, field
from typing import (
    List,
    AsyncGenerator,
    AsyncIterator,
    Iterator,
    Iterable,
)

from aioredis import Redis, Channel
from dacite import from_dict

from src.api.api_structures import Request, Update, CreateOrUpdateAction, DeleteAction
from src.room_store.room_store import (
    RoomStore,
)

logger = logging.getLogger(__name__)

NO_REQUEST_ID = "NO_REQUEST_ID"

# language=lua
_APPEND_TO_ROOM = """
local room_key = KEYS[1]
local channel_key = KEYS[2]
local room_update = ARGV[1]
local publish_value = ARGV[2]

redis.call("rpush", room_key, room_update)
redis.call("publish", channel_key, publish_value)
"""


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


def _channel_key(room_id: str) -> str:
    return f'channel:{room_id}'


@dataclass
class SubscriptionResult:
    changes: AsyncIterator[Request]
    subscribe_started: asyncio.Future[None] = field(default_factory=asyncio.Future)


class RedisRoomStore(RoomStore):
    def __init__(self, redis: Redis, append_to_room_sha: str):
        self._redis = redis
        self._append_to_room_sha = append_to_room_sha

    async def _listen_for_changes(
        self, room_id: str, channel: Channel
    ) -> AsyncIterator[Request]:
        try:
            while await channel.wait_message():
                yield from_dict(
                    Request, json.loads((await channel.get()).decode('utf-8'))
                )
        finally:
            if not self._redis.closed:
                await self._redis.unsubscribe(_channel_key(room_id))

    async def changes(self, room_id: str) -> AsyncIterator[Request]:
        channel = (await self._redis.subscribe(_channel_key(room_id)))[0]
        it = self._listen_for_changes(room_id, channel)
        return it

    async def get_all_room_ids(self) -> AsyncGenerator[str, None]:
        # A cursor of '0' tells redis.scan to start at the beginning
        cursor = b'0'
        while cursor:
            cursor, keys = await self._redis.scan(cursor, 'room:*')
            for key in keys:
                yield str(key[len('room:') :], 'utf-8')

    async def read(self, room_id: str) -> Iterable[Update]:
        data = await self._redis.lrange(_room_key(room_id), 0, -1, encoding='utf-8')
        return _to_updates(data)

    async def add_update(self, room_id: str, request: Request) -> None:
        await self._redis.evalsha(
            self._append_to_room_sha,
            keys=[_room_key(room_id), _channel_key(room_id)],
            args=[
                json.dumps(list(map(asdict, request.updates))),
                json.dumps(asdict(request)),
            ],
        )


async def create_redis_room_store(redis: Redis) -> RedisRoomStore:
    append_to_room = await redis.script_load(_APPEND_TO_ROOM)
    return RedisRoomStore(redis, append_to_room)


def _to_updates(raw_updates: List[str]) -> Iterator[Update]:
    for raw_update_group in raw_updates:
        update_group = json.loads(raw_update_group)
        for update in update_group:
            action = update['action']
            if action == 'create' or action == 'update':
                yield from_dict(CreateOrUpdateAction, update)
            elif action == 'delete':
                yield from_dict(DeleteAction, update)
