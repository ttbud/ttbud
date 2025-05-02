from collections.abc import AsyncIterable, Mapping
from typing import (
    Protocol,
)


class InvalidWebsocketState(Exception):
    pass


class WebsocketClient(Protocol):
    async def send(self, msg: str) -> None: ...

    def requests(self) -> AsyncIterable[str]: ...

    def ip(self) -> str: ...

    async def close(self, code: int) -> None: ...

    def path(self) -> str: ...

    async def accept(self) -> None: ...

    def headers(self) -> Mapping[str, str]: ...
