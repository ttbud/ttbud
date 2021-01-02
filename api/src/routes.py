from typing import List, Any

from starlette.routing import WebSocketRoute

from src.api.wsmanager import WebsocketManager
from src.ws.starlette_ws_client import StarletteWebsocketClient


def routes(ws: WebsocketManager) -> List[Any]:
    return [
        WebSocketRoute(
            '/{room_id}',
            lambda websocket: ws.connection_handler(
                StarletteWebsocketClient(websocket)
            ),
        )
    ]
