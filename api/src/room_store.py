import os
import json
from typing import Protocol, Iterable
from abc import abstractmethod
from dataclasses import asdict

from game_components import Token, Ping


class RoomStore(Protocol):
    path: str

    @abstractmethod
    def get_all_room_ids(self) -> list:
        raise NotImplementedError

    @abstractmethod
    def write_room_data(self, room_id: str, data: dict) -> None:
        raise NotImplementedError

    @abstractmethod
    def read_room_data(self, room_id: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def room_data_exists(self, room_id: str) -> bool:
        raise NotImplementedError


class FileRoomStore:
    def __init__(self, path):
        self.path = path
        os.makedirs(self.path, exist_ok=True)

    def get_all_room_ids(self) -> list:
        return os.listdir(self.path)

    def _is_valid_path(self, full_path: str) -> bool:
        return os.path.abspath(full_path).startswith(self.path)

    def write_room_data(self, room_id: str, data: Iterable[Token]) -> None:
        full_path = f'{self.path}/{room_id}'
        storable_data = list(map(asdict, data))
        if self._is_valid_path(full_path):
            with open(full_path, 'w') as f:
                f.write(json.dumps(storable_data))

    def read_room_data(self, room_id: str) -> dict:
        full_path = f'{self.path}/{room_id}'
        if self._is_valid_path(full_path):
            with open(full_path, 'r') as f:
                return json.loads(f.read())

    def room_data_exists(self, room_id: str) -> bool:
        return os.path.exists(f'{self.path}/{room_id}')


class MemoryRoomStore:
    def __init__(self, path):
        self.path = path
        self.stored_data = {}

    def get_all_room_ids(self) -> list:
        return list(self.stored_data.keys())

    def write_room_data(self, room_id: str, data: Iterable[Token]) -> None:
        storable_data = list(map(asdict, data))
        self.stored_data[room_id] = storable_data

    def read_room_data(self, room_id: str) -> dict:
        return self.stored_data[room_id]

    def room_data_exists(self, room_id: str) -> bool:
        return room_id in self.stored_data.keys()
