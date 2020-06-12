from __future__ import annotations
import os
import json
import ssl
from enum import Enum
from ssl import SSLContext
from typing import (
    Protocol,
    Iterable,
    Optional,
    List,
    Dict,
    AsyncIterator,
    Union,
)
from abc import abstractmethod
from dataclasses import asdict

import aioredis
from aioredis import Redis

from .game_components import Token


class RoomStore(Protocol):
    @abstractmethod
    def get_all_room_ids(self) -> AsyncIterator[str]:
        raise NotImplementedError

    @abstractmethod
    async def write_room_data(self, room_id: str, data: Iterable[Token]) -> None:
        raise NotImplementedError

    @abstractmethod
    async def read_room_data(self, room_id: str) -> Optional[List[dict]]:
        raise NotImplementedError


class FileRoomStore(RoomStore):
    def __init__(self, path: str):
        self.path = path
        os.makedirs(self.path, exist_ok=True)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for file in os.listdir(self.path):
            yield file

    def _is_valid_path(self, full_path: str) -> bool:
        return os.path.abspath(full_path).startswith(self.path)

    async def write_room_data(self, room_id: str, data: Iterable[Token]) -> None:
        full_path = f'{self.path}/{room_id}'
        storable_data = list(map(asdict, data))
        if self._is_valid_path(full_path):
            with open(full_path, 'w') as f:
                f.write(json.dumps(storable_data))
        else:
            raise ValueError(f'path {full_path} is not a valid path')

    async def read_room_data(self, room_id: str) -> Optional[List[dict]]:
        full_path = f'{self.path}/{room_id}'
        if self._is_valid_path(full_path) and os.path.exists(full_path):
            with open(full_path, 'r') as f:
                return json.loads(f.read())

        return None


class MemoryRoomStore(RoomStore):
    def __init__(self) -> None:
        self.stored_data: Dict[str, List[dict]] = {}

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for key in self.stored_data.keys():
            yield key

    async def write_room_data(self, room_id: str, data: Iterable[Token]) -> None:
        storable_data = list(map(asdict, data))
        self.stored_data[room_id] = storable_data

    async def read_room_data(self, room_id: str) -> Optional[List[dict]]:
        return self.stored_data.get(room_id)


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


class SSLValidation(Enum):
    # No SSL at all. Free heroku redis instances (which we use for staging) do not
    # support SSL
    NONE = 'none'
    # Use SSL, but disable cert verification.
    # Heroku's _paid_ redis plans (which we use in production) have self-signed certs
    # without a consistent key we can trust :(. If we ever start handling data that's
    # even remotely private, we'll have to find a better solution
    SELF_SIGNED = 'self_signed'
    # Full SSL verification
    DEFAULT = 'default'


class RedisRoomStore(RoomStore):
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @staticmethod
    async def obtain(address: str, ssl_validation: SSLValidation) -> RedisRoomStore:
        ssl_context: Union[SSLContext, bool]
        if ssl_validation == SSLValidation.SELF_SIGNED:
            ssl_context = SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.VerifyMode.CERT_NONE
        elif ssl_validation == SSLValidation.NONE:
            ssl_context = False
        else:
            ssl_context = ssl.create_default_context()

        redis = await aioredis.create_redis_pool(address, ssl=ssl_context)
        return RedisRoomStore(redis)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        # A cursor of '0' tells redis.scan to start at the beginning
        cursor = b'0'
        while cursor:
            cursor, keys = await self.redis.scan(cursor, 'room:*')
            for key in keys:
                yield str(key[len('room:') :], 'utf-8')

    async def write_room_data(self, room_id: str, data: Iterable[Token]) -> None:
        await self.redis.set(_room_key(room_id), json.dumps(list(map(asdict, data))))

    async def read_room_data(self, room_id: str) -> Optional[List[dict]]:
        data = await self.redis.get(_room_key(room_id), encoding='utf-8')
        if data:
            return json.loads(data)
        return None
