from dataclasses import dataclass, field
from typing import Union, Iterable, Literal, List

from src.game_components import Ping, Token


@dataclass
class ConnectionResponse:
    data: Iterable[Union[Ping, Token]]
    type: Literal['connection'] = field(init=False, default='connection')


@dataclass
class StateResponse:
    data: Iterable[Union[Ping, Token]]
    request_id: str
    type: Literal['state'] = field(init=False, default='state')


@dataclass
class ErrorResponse:
    data: str
    request_id: str
    session_id: str
    type: Literal['error'] = field(init=False, default='error')


Response = Union[ConnectionResponse, StateResponse, ErrorResponse]


@dataclass
class CreateOrUpdateAction:
    action: Literal['create', 'update']
    data: Token


@dataclass
class DeleteAction:
    action: Literal['delete']
    data: str


@dataclass
class PingAction:
    action: Literal['ping']
    data: Ping


Update = Union[CreateOrUpdateAction, DeleteAction, PingAction]


@dataclass
class Request:
    request_id: str
    updates: List[Update]
