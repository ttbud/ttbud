from collections.abc import Awaitable, Callable
from typing import Any

from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route, WebSocketRoute

from src.api.wsmanager import WebsocketManager
from src.ws.starlette_ws_client import StarletteWebsocketClient


def routes(
    stats_endpoint: Callable[[Request], Awaitable[Response]], ws: WebsocketManager
) -> list[Any]:
    return [
        Route('/stats', stats_endpoint),
        WebSocketRoute(
            '/{room_id}',
            lambda websocket: ws.connection_handler(
                StarletteWebsocketClient(websocket)
            ),
        ),
    ]
