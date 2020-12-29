from typing import Callable, Awaitable, Optional

from starlette.types import ASGIApp, Scope, Receive, Send

AppFactory = Callable[[], Awaitable[ASGIApp]]


class LazyASGI:
    def __init__(self, make_asgi: AppFactory):
        self._make_asgi = make_asgi
        self._asgi: Optional[ASGIApp] = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not self._asgi:
            self._asgi = await self._make_asgi()
        await self._asgi(scope, receive, send)
