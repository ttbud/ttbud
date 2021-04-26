from dataclasses import dataclass, field
from typing import Union, Iterable, Literal, List

from src.game_components import Ping, Token


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


Action = Union[UpsertAction, DeleteAction, PingAction]


@dataclass
class ConnectionResponse:
    data: Iterable[Token]
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


Response = Union[ConnectionResponse, UpdateResponse, ErrorResponse]


@dataclass
class Request:
    request_id: str
    actions: List[Action]
