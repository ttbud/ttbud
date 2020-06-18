from __future__ import annotations
import os
import json
from typing import (
    Protocol,
    Iterable,
    Optional,
    List,
    Dict,
    AsyncIterator,
)
from abc import abstractmethod
from dataclasses import asdict

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


class RedisRoomStore(RoomStore):
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

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
