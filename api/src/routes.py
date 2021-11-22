from typing import List, Any, Callable, Awaitable

from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import WebSocketRoute, Route

from src.api.wsmanager import WebsocketManager
from src.ws.starlette_ws_client import StarletteWebsocketClient


def routes(
    stats_endpoint: Callable[[Request], Awaitable[Response]], ws: WebsocketManager
) -> List[Any]:
    return [
        Route('/stats', stats_endpoint),
        WebSocketRoute(
            '/{room_id}',
            lambda websocket: ws.connection_handler(
                StarletteWebsocketClient(websocket)
            ),
        ),
    ]
