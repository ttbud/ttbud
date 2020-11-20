from __future__ import annotations

import json
import logging
from asyncio import Lock
from typing import (
    Protocol,
    Optional,
    List,
    Dict,
    AsyncIterator,
    Union,
    Callable,
    TypeVar,
    Awaitable,
    Coroutine,
    Any,
)
from dataclasses import asdict

from aioredis import Redis, MultiExecError
from dacite import WrongTypeError, MissingValueError, from_dict

from .default_weak_value_dict import DefaultWeakValueDict
from .game_components import Token, Ping

MAX_UPDATE_RETRIES = 3

EntityList = List[Union[Ping, Token]]
logger = logging.getLogger(__name__)


class MutationResult(Protocol):
    entities: EntityList


MutationResultType = TypeVar('MutationResultType', bound=MutationResult)


class InvalidState(Exception):
    pass


class TransactionFailed(Exception):
    pass


class RoomStore(Protocol):
    def get_all_room_ids(self) -> AsyncIterator[str]:
        ...

    async def read(self, room_id: str) -> Optional[EntityList]:
        ...

    async def apply_mutation(
        self,
        room_id: str,
        mutation: Callable[
            [Optional[EntityList]],
            Union[
                Awaitable[MutationResultType], Coroutine[Any, Any, MutationResultType]
            ],
        ],
    ) -> MutationResultType:
        ...


def _to_entities(room_id: str, raw_entities: List[dict]) -> List[Union[Ping, Token]]:
    room = []
    for raw_entity in raw_entities:
        try:
            entity: Union[Ping, Token]
            if (
                raw_entity.get('type') == 'character'
                or raw_entity.get('type') == 'floor'
            ):
                entity = from_dict(data_class=Token, data=raw_entity)
            else:
                entity = from_dict(data_class=Ping, data=raw_entity)

            room.append(entity)
        except (WrongTypeError, MissingValueError, TypeError):
            # Don't raise here. Loading a room minus any tokens that
            # have been corrupted is still valuable.
            logger.exception(
                f'Corrupted room {room_id}',
                extra={'invalid_token': raw_entity},
                exc_info=True,
            )
    return room


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: Optional[Dict[str, EntityList]] = None) -> None:
        self.stored_data = storage if storage is not None else {}

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        return self.stored_data.get(room_id, None)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for key in self.stored_data.keys():
            yield key

    async def apply_mutation(
        self,
        room_id: str,
        mutate: Callable[
            [Optional[EntityList]],
            Union[
                Awaitable[MutationResultType], Coroutine[Any, Any, MutationResultType]
            ],
        ],
    ) -> MutationResultType:
        initial_entities = await self.read(room_id)
        result = await mutate(initial_entities)
        if self.stored_data.get(room_id, None) != initial_entities:
            raise TransactionFailed()
        self.stored_data[room_id] = result.entities
        return result


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


class RedisRoomStore(RoomStore):
    def __init__(self, redis: Redis):
        self.redis = redis
        self.room_locks_by_id = DefaultWeakValueDict(Lock)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        # A cursor of '0' tells redis.scan to start at the beginning
        cursor = b'0'
        while cursor:
            cursor, keys = await self.redis.scan(cursor, 'room:*')
            for key in keys:
                yield str(key[len('room:') :], 'utf-8')

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        data = await self.redis.get(_room_key(room_id), encoding='utf-8')
        return _to_entities(room_id, json.loads(data)) if data else None

    async def apply_mutation(
        self,
        room_id: str,
        mutate: Callable[[Optional[EntityList]], Awaitable[MutationResultType]],
    ) -> MutationResultType:
        # Keep track of transactions locally as well to eliminate same-server
        # transaction conflicts
        async with self.room_locks_by_id[room_id]:
            # aioredis executes each command on an arbitrary open redis connection
            # This completely breaks WATCH functionality because you could WATCH
            # on one connection and then execute on a different one.
            # To work around this, we acquire a specific connection for the transaction
            # and release it when the transaction is finished
            retry_count = 0
            success = False
            result = None
            while not success or retry_count >= MAX_UPDATE_RETRIES:
                conn = await self.redis.connection.acquire()
                transaction_redis = Redis(conn)
                room_key = _room_key(room_id)
                await transaction_redis.watch(room_key)
                data = await transaction_redis.get(_room_key(room_id), encoding='utf-8')
                entities = _to_entities(room_id, json.loads(data)) if data else None
                try:
                    result = await mutate(entities)
                    tr = transaction_redis.multi_exec()
                    try:
                        tr.set(
                            _room_key(room_id),
                            json.dumps(list(map(asdict, result.entities))),
                        )
                        await tr.execute()
                        success = True
                    except MultiExecError as e:
                        raise TransactionFailed() from e
                finally:
                    if not success:
                        await transaction_redis.unwatch()
                    self.redis.connection.release(conn)

            if retry_count >= MAX_UPDATE_RETRIES or result is None:
                raise TransactionFailed('Maximum retries attempted')

            return result
