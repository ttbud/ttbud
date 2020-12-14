from dataclasses import dataclass
from typing import Union, Iterable, Optional, Literal, List

from src.game_components import Ping, Token


@dataclass
class Response:
    type: str
    data: Union[str, Iterable[Union[Ping, Token]]]
    request_id: Optional[str] = None


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


@dataclass
class Request:
    request_id: str
    updates: List[Union[CreateOrUpdateAction, DeleteAction, PingAction]]
