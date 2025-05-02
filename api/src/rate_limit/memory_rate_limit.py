import time
from collections import defaultdict
from collections.abc import AsyncGenerator, Iterable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

from src.rate_limit.rate_limit import (
    MAX_CONNECTIONS_PER_ROOM,
    MAX_CONNECTIONS_PER_USER,
    MAX_ROOMS_PER_TEN_MINUTES,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    RateLimiter,
    RoomFullException,
    TooManyConnectionsException,
    TooManyRoomsCreatedException,
)


@dataclass
class User:
    connections_by_server_id: dict[str, int] = field(default_factory=dict)
    room_creation_times: list[float] = field(default_factory=list)


@dataclass
class MemoryRateLimiterStorage:
    server_expirations_by_id: dict[str, float] = field(default_factory=dict)
    users_by_id: dict[str, User] = field(default_factory=dict)
    room_connections_by_server_id: dict[str, list[str]] = field(
        default_factory=lambda: defaultdict(list)
    )


class MemoryRateLimiter(RateLimiter):
    def __init__(self, server_id: str, storage: MemoryRateLimiterStorage):
        self._server_id = server_id
        self._storage = storage
        self._storage.server_expirations_by_id[server_id] = (
            time.time() + SERVER_LIVENESS_EXPIRATION_SECONDS
        )

    @asynccontextmanager
    async def rate_limited_connection(
        self, user_id: str, room_id: str
    ) -> AsyncGenerator[None, None]:
        await self.acquire_connection(user_id, room_id)
        try:
            yield
        finally:
            await self.release_connection(user_id, room_id)

    async def acquire_connection(self, user_id: str, room_id: str) -> None:
        now = time.time()
        self._acquire_server_connection(now, user_id)
        self._acquire_room_slot(now, room_id)

    def _acquire_room_slot(self, timestamp: float, room_id: str) -> None:
        connection_count = 0
        for server_id, rooms in self._storage.room_connections_by_server_id.items():
            if self._storage.server_expirations_by_id[server_id] > timestamp:
                connection_count += rooms.count(room_id)
        if connection_count >= MAX_CONNECTIONS_PER_ROOM:
            raise RoomFullException()
        self._storage.room_connections_by_server_id[self._server_id].append(room_id)

    def _acquire_server_connection(self, timestamp: float, user_id: str) -> None:
        user = self._storage.users_by_id.get(user_id, User())

        connection_count = 0
        for server_id, count in user.connections_by_server_id.items():
            if self._storage.server_expirations_by_id[server_id] >= timestamp:
                connection_count += count
        if connection_count >= MAX_CONNECTIONS_PER_USER:
            raise TooManyConnectionsException()

        server_connection_count = user.connections_by_server_id.get(self._server_id, 0)
        user.connections_by_server_id[self._server_id] = server_connection_count + 1
        self._storage.users_by_id[user_id] = user

    async def release_connection(self, user_id: str, room_id: str) -> None:
        user = self._storage.users_by_id.get(user_id)
        if not user:
            return None

        server_connection_count = user.connections_by_server_id.get(self._server_id, 0)
        if server_connection_count:
            user.connections_by_server_id[self._server_id] = server_connection_count - 1

        room_connections = self._storage.room_connections_by_server_id[self._server_id]
        if room_id in room_connections:
            room_connections.remove(room_id)

    async def refresh_server_liveness(self, user_ids: Iterable[str]) -> None:
        self._storage.server_expirations_by_id[self._server_id] = (
            time.time() + SERVER_LIVENESS_EXPIRATION_SECONDS
        )

    async def acquire_new_room(self, user_id: str) -> None:
        user = self._storage.users_by_id.get(user_id, User())
        now = time.time()
        rooms_created_in_last_ten_minutes = 0
        for creation_time in user.room_creation_times:
            if (creation_time - now) < 10 * 60:
                rooms_created_in_last_ten_minutes += 1

        if rooms_created_in_last_ten_minutes >= MAX_ROOMS_PER_TEN_MINUTES:
            raise TooManyRoomsCreatedException()

        user.room_creation_times.append(now)
        self._storage.users_by_id[user_id] = user

    async def get_total_num_connections(self) -> int:
        total_connections = 0
        for _, connections in self._storage.room_connections_by_server_id.items():
            total_connections += len(connections)
        return total_connections
