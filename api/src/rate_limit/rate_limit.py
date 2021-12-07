from __future__ import annotations

from typing import Protocol, AsyncContextManager, Iterator

MAX_ROOMS_PER_TEN_MINUTES = 50
MAX_CONNECTIONS_PER_USER = 10
MAX_CONNECTIONS_PER_ROOM = 20
SERVER_LIVENESS_EXPIRATION_SECONDS = 60 * 10


class RoomFullException(Exception):
    pass


class TooManyConnectionsException(Exception):
    pass


class TooManyRoomsCreatedException(Exception):
    pass


class RateLimiter(Protocol):
    async def acquire_connection(self, user_id: str, room_id: str) -> None:
        """
        Reserve a connection for user identified by user_id.
        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        :param room_id: The unique room id the user is connecting to
        :raises TooManyConnectionsException if the user already has
        MAX_CONNECTIONS_PER_USER active connections
        """
        ...

    async def release_connection(self, user_id: str, room_id: str) -> None:
        """
        Release a connection for the given user id
        :param room_id: The unique room id the user is disconnecting from
        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        """
        ...

    def rate_limited_connection(
        self, user_id: str, room_id: str
    ) -> AsyncContextManager:
        """
        Reserve a connection for the given user_id for the duration of the
        context
        :param room_id: The unique room id the user is connecting to
        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        :raises TooManyConnectionsException if the user already has
        MAX_CONNECTIONS_PER_USER active connections
        """
        ...

    async def refresh_server_liveness(self, user_ids: Iterator[str]) -> None:
        """
        This function should be called every
        SERVER_LIVENESS_EXPIRATION_SECONDS/3 while the server is operating
        """
        ...

    async def acquire_new_room(self, user_id: str) -> None:
        """
        Increment the number of rooms this user has created in the last ten minutes

        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        :raises TooManyRoomsCreatedException if the user has already created too
        many rooms recently
        """
        ...

    async def get_total_num_connections(self) -> int:
        """
        :return: Total number of active user connections
        """
        ...
