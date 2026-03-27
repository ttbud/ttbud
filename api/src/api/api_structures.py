from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

from src.game_components import Ping, Token

BYPASS_RATE_LIMIT_HEADER = 'X-BYPASS-RATE-LIMITER'


# Inherit from str so that the enum is JSON serializable
class GridType(str, Enum):
    SQUARE = 'square'
    HEX = 'hex'


@dataclass
class UpsertAction:
    data: Token
    action: Literal['upsert'] = field(init=False, default='upsert')


@dataclass
class DeleteAction:
    data: str
    action: Literal['delete'] = field(init=False, default='delete')


@dataclass
class PingAction:
    data: Ping
    action: Literal['ping'] = field(init=False, default='ping')


@dataclass
class SetGridTypeAction:
    data: GridType
    action: Literal['set-grid-type'] = field(init=False, default='set-grid-type')


Action = UpsertAction | DeleteAction | PingAction | SetGridTypeAction


@dataclass
class ConnectionResponse:
    data: Iterable[Token]
    grid_type: GridType
    type: Literal['connected'] = field(init=False, default='connected')


@dataclass
class UpdateResponse:
    actions: Iterable[Action]
    request_id: str
    type: Literal['update'] = field(init=False, default='update')


@dataclass
class ErrorResponse:
    data: str
    request_id: str
    session_id: str
    type: Literal['error'] = field(init=False, default='error')


Response = ConnectionResponse | UpdateResponse | ErrorResponse


@dataclass
class Request:
    request_id: str
    actions: list[Action]
