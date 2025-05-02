from collections.abc import AsyncIterable, Mapping
from typing import TypedDict, cast

from starlette.websockets import WebSocket

from src.util.ip import get_client_ip
from src.ws.ws_client import WebsocketClient


class StarletteWebsocketClient(WebsocketClient):
    def __init__(self, websocket: WebSocket):
        self._websocket = websocket
        # Starlette just describes the scope as a MutableMapping[str, Any],
        # but we can be more specific
        self._scope = cast(WebsocketScope, websocket.scope)

    async def send(self, msg: str) -> None:
        await self._websocket.send_text(msg)

    def requests(self) -> AsyncIterable[str]:
        return self._websocket.iter_text()

    def ip(self) -> str:
        ip_addr, _ = self._scope['client']
        return get_client_ip(ip_addr, self._websocket.headers)

    async def close(self, code: int) -> None:
        await self._websocket.close(code)

    def path(self) -> str:
        return self._scope['path']

    async def accept(self) -> None:
        await self._websocket.accept()

    def headers(self) -> Mapping[str, str]:
        return self._websocket.headers


class WebsocketScope(TypedDict):
    """
    Describes just the parts of the ASGI websocket scope that we use.
    See https://asgi.readthedocs.io/en/latest/specs/www.html#websocket-connection-scope
    for more details
    """

    client: tuple[str, int]
    """
    A two-item iterable of [host, port], where host is the remote host’s IPv4
    or IPv6 address, and port is the remote port. Optional; if missing
    defaults to None.
    """
    path: str
    """
    HTTP request target excluding any query string, with percent-encoded
    sequences and UTF-8 byte sequences decoded into characters.
    """
