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
    Dict,
    Any,
)

from aioredis import Redis
from aioredis.errors import ReplyError
from dacite import from_dict

from src.api.api_structures import Request, Action, UpsertAction, DeleteAction
from src.room_store.room_store import (
    RoomStore,
    ReplacementData,
    UnexpectedReplacementId,
    COMPACTION_LOCK_EXPIRATION_MINUTES,
)

logger = logging.getLogger(__name__)

NO_REQUEST_ID = "NO_REQUEST_ID"
REPLACEMENT_KEY = 'replacement_lock'

# language=lua
_APPEND_TO_ROOM = """
local room_key = KEYS[1]
local channel_key = KEYS[2]
local room_update = ARGV[1]
local publish_value = ARGV[2]

redis.call("rpush", room_key, room_update)
redis.call("publish", channel_key, publish_value)
"""


# language=lua
_SET_REPLACEMENT_LOCK = f"""
local replacement_key = KEYS[1]
local replacer_id = ARGV[1]

local success = redis.call("setnx", replacement_key, replacer_id)
if success == 1 then
    redis.call("expire", replacement_key, {COMPACTION_LOCK_EXPIRATION_MINUTES * 60})
    return true
else
    return false
end
"""


# language=lua
_LREPLACE = """
local room_key = KEYS[1]
local compaction_key = KEYS[2]
local replace_item = ARGV[1]
local replace_until = ARGV[2]
local compactor_id = ARGV[3]

if redis.call("get", compaction_key) == compactor_id then
    redis.call("ltrim", room_key, replace_until, -1)
    redis.call("lpush", room_key, replace_item)
else
    error("Unexpected value for compaction key")
end
"""


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


def _channel_key(room_id: str) -> str:
    return f'channel:{room_id}'


@dataclass
class ChangeListener:
    output_queues: List[asyncio.Queue[Request]]
    task: asyncio.Task
    subscribe_started: asyncio.Future[None] = field(default_factory=asyncio.Future)


class RedisRoomStore(RoomStore):
    def __init__(
        self,
        redis: Redis,
        append_to_room_sha: str,
        set_replacement_lock_sha: str,
        lreplace_sha: str,
    ):
        self._redis = redis
        self._append_to_room_sha = append_to_room_sha
        self._set_replacement_lock_sha = set_replacement_lock_sha
        self._lreplace_sha = lreplace_sha
        self._listeners_by_room_id: Dict[str, ChangeListener] = dict()

    async def _listen_for_changes(self, room_id: str) -> None:
        listener = self._listeners_by_room_id[room_id]
        queues = listener.output_queues
        channel = (await self._redis.subscribe(_channel_key(room_id)))[0]
        listener.subscribe_started.set_result(None)
        try:
            while await channel.wait_message():
                update = from_dict(
                    Request, json.loads((await channel.get()).decode('utf-8'))
                )
                for q in queues:
                    await q.put(update)
        finally:
            if not self._redis.closed:
                await self._redis.unsubscribe(_channel_key(room_id))

    async def changes(self, room_id: str) -> AsyncIterator[Request]:
        listener = self._listeners_by_room_id.get(room_id)
        if not listener:
            listener = ChangeListener(
                [],
                asyncio.create_task(
                    self._listen_for_changes(room_id), name=f'Redis Pubsub {room_id}'
                ),
            )
            self._listeners_by_room_id[room_id] = listener
        # This function shouldn't return until we've actually started listening
        # for changes so that consumers know they're not missing events once they
        # get the iterator back
        await listener.subscribe_started

        queue: asyncio.Queue[Request] = asyncio.Queue()
        listener.output_queues.append(queue)

        return self._room_changes(room_id, queue)

    async def _room_changes(
        self, room_id: str, queue: asyncio.Queue[Request]
    ) -> AsyncIterator[Request]:
        try:
            while True:
                yield await queue.get()
        finally:
            listener = self._listeners_by_room_id[room_id]
            listener.output_queues.remove(queue)
            if not listener.output_queues:
                listener.task.cancel()
                if room_id in self._listeners_by_room_id:
                    del self._listeners_by_room_id[room_id]

    async def get_all_room_ids(self) -> AsyncGenerator[str, None]:
        # A cursor of '0' tells redis.scan to start at the beginning
        cursor = b'0'
        while cursor:
            cursor, keys = await self._redis.scan(cursor, 'room:*')
            for key in keys:
                yield str(key[len('room:') :], 'utf-8')

    async def room_exists(self, room_id: str) -> bool:
        return bool(await self._redis.exists(_room_key(room_id)))

    async def read(self, room_id: str) -> Iterable[Action]:
        data = await self._redis.lrange(_room_key(room_id), 0, -1, encoding='utf-8')
        return _to_actions(data)

    async def add_request(self, room_id: str, request: Request) -> None:
        await self._redis.evalsha(
            self._append_to_room_sha,
            keys=[_room_key(room_id), _channel_key(room_id)],
            args=[
                json.dumps(
                    list(
                        map(
                            asdict,
                            filter(lambda x: x.action != 'ping', request.actions),
                        )
                    )
                ),
                json.dumps(asdict(request)),
            ],
        )

    async def acquire_replacement_lock(self, replacer_id: str) -> bool:
        return (
            await self._redis.evalsha(
                self._set_replacement_lock_sha,
                keys=[REPLACEMENT_KEY],
                args=[replacer_id],
            )
            == 1
        )

    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        updates = await self._redis.lrange(_room_key(room_id), 0, -1, encoding='utf-8')
        actions = [action for action in _to_actions(updates)]
        return ReplacementData(actions, len(updates))

    async def replace(
        self, room_id: str, actions: List[Action], replace_token: Any, replacer_id: str
    ) -> None:
        try:
            await self._redis.evalsha(
                self._lreplace_sha,
                keys=[
                    _room_key(room_id),
                    REPLACEMENT_KEY,
                ],
                args=[
                    json.dumps(list(map(asdict, actions))),
                    replace_token,
                    replacer_id,
                ],
            )
        except ReplyError as e:
            raise UnexpectedReplacementId(e.args)


async def create_redis_room_store(redis: Redis) -> RedisRoomStore:
    append_to_room = await redis.script_load(_APPEND_TO_ROOM)
    set_replacement_lock = await redis.script_load(_SET_REPLACEMENT_LOCK)
    lreplace = await redis.script_load(_LREPLACE)
    return RedisRoomStore(redis, append_to_room, set_replacement_lock, lreplace)


def _to_actions(raw_updates: List[str]) -> Iterator[Action]:
    for raw_update_group in raw_updates:
        update_group = json.loads(raw_update_group)
        for update in update_group:
            action = update['action']
            # Older version uses "update" or "create" instead of upsert
            if action in ['upsert', 'update', 'create']:
                update['action'] = 'upsert'
                yield from_dict(UpsertAction, update)
            elif action == 'delete':
                yield from_dict(DeleteAction, update)
