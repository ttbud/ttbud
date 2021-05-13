from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import (
    Any,
    Optional,
    Literal,
    Iterable,
    Tuple,
    Protocol,
    Awaitable,
    Callable,
    Union,
    TypeVar,
    TypedDict,
    cast,
    AsyncIterator,
    Mapping,
)


class WebsocketClosed(Exception):
    def __init__(self, code: int):
        self.code = code


class UnexpectedResponse(Exception):
    ...


class RequiredAsgi(TypedDict):
    version: Literal['2', '3']
    """The version of the ASGI spec."""


class Asgi(RequiredAsgi, total=False):
    spec_version: Literal['2.0', '2.1']
    """Version of the ASGI HTTP spec this server understands; one of "2.0" or "2.1".
    If missing assume "2.0". """


class RequiredWebsocketScope(TypedDict):
    type: Literal['websocket']
    asgi: Asgi
    path: str
    """HTTP request target excluding any query string, with percent-encoded
    sequences and UTF-8 byte sequences decoded into characters."""
    headers: Iterable[Tuple[bytes, bytes]]
    """An iterable of [name, value] two-item iterables, where name is the header name
    and value is the header value. Order should be preserved from the original HTTP
    request; duplicates are possible and must be preserved in the message as
    received. Header names must be lowercased. Pseudo headers (present in HTTP/2 and
    HTTP/3) must be removed; if :authority is present its value must be added to the
    start of the iterable with host as the header name or replace any existing host
    header already present."""
    client: Tuple[str, int]
    """A two-item iterable of [host, port], where host is the remote host’s IPv4 or
    IPv6 address, and port is the remote port. Optional; if missing defaults to None.
    """


class WebsocketScope(RequiredWebsocketScope, total=False):
    http_version: Literal['1.1', '2']
    scheme: str
    """URL scheme portion (likely "ws" or "wss"). Optional (but must not be empty);
    default is "ws". """
    raw_path: bytes
    """The original HTTP path component unmodified from the bytes that were
    received by the web server. Some web server implementations may be unable to
    provide this. Optional; if missing defaults to None."""
    query_string: bytes
    """URL portion after the ?. Optional; if missing default is empty string."""
    root_path: bytes
    """The root path this application is mounted at; same as SCRIPT_NAME in
    WSGI. Optional; if missing defaults to empty string."""
    server: Tuple[str, Optional[int]]
    """Either a two-item iterable of [host, port], where host is the listening
    address for this server, and port is the integer listening port, or [path,
    None] where path is that of the unix socket. Optional; if missing defaults to
    None."""
    subprotocols: Iterable[str]
    """Subprotocols the client advertised. Optional; if missing defaults to empty
    list."""


class Connect(TypedDict):
    """Sent to the application when the client initially opens a connection and is
    about to finish the WebSocket handshake.

    This message must be responded to with either an Accept message or a Close
    message before the socket will pass websocket.receive messages. The protocol
    server must send this message during the handshake phase of the WebSocket and not
    complete the handshake until it gets a reply, returning HTTP status code 403 if
    the connection is denied.
    """

    type: Literal['websocket.connect']


class AcceptRequired(TypedDict):
    type: Literal['websocket.accept']


class Accept(AcceptRequired, total=False):
    """Sent by the application when it wishes to accept an incoming connection."""

    subprotocol: str
    """The subprotocol the server wishes to accept. Optional; if missing defaults to
    None. """
    headers: Iterable[Tuple[bytes, bytes]]
    """An iterable of [name, value] two-item iterables, where name is the header
    name, and value is the header value. Order must be preserved in the HTTP
    response. Header names must be lowercased. Must not include a header named
    sec-websocket-protocol; use the subprotocol key instead. Optional; if missing
    defaults to an empty list. Added in spec version 2.1. Pseudo headers (present in
    HTTP/2 and HTTP/3) must not be present."""


class ReceiveText(TypedDict):
    """Sent to the application when a data message is received from the client in
    text mode."""

    type: Literal['websocket.receive']
    text: str


class ReceiveBytes(TypedDict):
    """Sent to the application when a data message is received from the client in
    binary mode."""

    type: Literal['websocket.receive']
    bytes: bytes


class SendBytes(TypedDict):
    """Sent by the application to send a binary data message to the client."""

    type: Literal['websocket.send']
    bytes: bytes


class SendText(TypedDict):
    """Sent by the application to send a textual data message to the client."""

    type: Literal['websocket.send']
    text: str


class Disconnect(TypedDict):
    """Sent to the application when either connection to the client is lost,
    either from the client closing the connection, the server closing the connection,
    or loss of the socket."""

    type: Literal['websocket.disconnect']
    code: int
    """The WebSocket close code, as per the WebSocket spec."""


class Close(TypedDict, total=False):
    """Sent by the application to tell the server to close the connection.

    If this is sent before the socket is accepted, the server must close the
    connection with a HTTP 403 error code (Forbidden), and not complete the WebSocket
    handshake; this may present on some browsers as a different WebSocket error code
    (such as 1006, Abnormal Closure).

    If this is sent after the socket is accepted, the server must close the socket
    with the close code passed in the message (or 1000 if none is specified).
    """

    type: Literal['websocket.disconnect']
    code: int
    """The WebSocket close code, as per the WebSocket spec. Optional; if missing
    defaults to 1000. """


IncomingEvent = Union[Connect, ReceiveText, ReceiveBytes, Disconnect]
OutgoingEvent = Union[Accept, SendText, SendBytes, Close]


class WebsocketAsgiApp(Protocol):
    async def __call__(
        self,
        scope: WebsocketScope,
        receive: Callable[[], Awaitable[IncomingEvent]],
        send: Callable[[OutgoingEvent], Awaitable[None]],
    ) -> None:
        pass


_T = TypeVar('_T')


class EmulatedClient:
    def __init__(
        self,
        input_q: asyncio.Queue[IncomingEvent],
        output_q: asyncio.Queue[OutgoingEvent],
    ):
        self._input_q = input_q
        self._output_q = output_q

    async def send(self, text: str) -> None:
        await self._input_q.put({'type': 'websocket.receive', 'text': text})

    async def send_json(self, data: Any) -> None:
        await self.send(json.dumps(data))

    async def disconnect(self, code: int = 1000) -> None:
        await self._input_q.put({'type': 'websocket.disconnect', 'code': code})

    async def receive(self) -> OutgoingEvent:
        return await self._output_q.get()

    async def receive_text(self) -> str:
        event = await self.receive()
        if event['type'] == 'websocket.close':
            raise WebsocketClosed(event['code'])
        if event['type'] != 'websocket.send':
            raise UnexpectedResponse(event)

        if 'text' in event:
            event = cast(SendText, event)
            return event['text']
        else:
            event = cast(SendBytes, event)
            return str(event['bytes'], 'utf-8')

    async def receive_json(self) -> Any:
        return json.loads(await self.receive_text())


@asynccontextmanager
async def connect(
    app: WebsocketAsgiApp,
    path: str,
    client_ip: str = '127.0.0.1',
    headers: Optional[Mapping[str, str]] = None,
) -> AsyncIterator[EmulatedClient]:
    """Create an emulated client connected to the provided app"""
    headers = {} if headers is None else headers

    scope = WebsocketScope(
        type='websocket',
        asgi=Asgi(version='3'),
        headers=[
            (key.lower().encode('latin-1'), value.encode('latin-1'))
            for key, value in headers.items()
        ],
        client=(client_ip, 65535),
        path=path,
    )

    input_q: asyncio.Queue[IncomingEvent] = asyncio.Queue()
    output_q: asyncio.Queue[OutgoingEvent] = asyncio.Queue()

    app_task = asyncio.create_task(
        app(scope, input_q.get, output_q.put),
        name=f'Connection from {client_ip} to {path}',
    )
    await input_q.put({'type': 'websocket.connect'})
    response = await output_q.get()

    try:
        if response['type'] == 'websocket.accept':
            client = EmulatedClient(input_q, output_q)
            yield client
            await input_q.put({'type': 'websocket.disconnect', 'code': 1000})
            await app_task
        elif response['type'] == 'websocket.close':
            raise WebsocketClosed(response['code'])
        else:
            raise UnexpectedResponse(response)
    finally:
        app_task.cancel()
        await app_task
