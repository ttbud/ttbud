import json
import logging
from collections.abc import Iterator
from dataclasses import asdict
from enum import Enum
from typing import Any, TypeVar

import dacite

from src.api.api_structures import (
    Action,
    DeleteAction,
    Request,
    Response,
    SetGridTypeAction,
    UpsertAction,
)

T = TypeVar('T')

logger = logging.getLogger(__name__)


def ignore_none(items: list[tuple[str, Any]]) -> dict[str, Any]:
    return dict(filter(lambda entry: entry[1] is not None, items))


class InvalidJSONError(Exception):
    def __init__(self, json: str, target_type: type) -> None:
        self.json = json
        self.target_type = target_type

    def __str__(self) -> str:
        return (
            f'Failed to decode JSON "{self.json}" to type "{self.target_type.__name__}"'
        )


class JSONSerializer:
    def __init__(self) -> None:
        self.config = dacite.Config(cast=[Enum])

    def deserialize_request(self, json_string: str) -> Request:
        try:
            data = json.loads(json_string)
            return dacite.from_dict(Request, data, self.config)
        except (json.JSONDecodeError, dacite.DaciteError) as e:
            raise InvalidJSONError(json_string, Request) from e

    def serialize_response(self, obj: Response) -> str:
        return json.dumps(asdict(obj, dict_factory=ignore_none))

    def serialize_actions(self, actions: list[Action]) -> str:
        return json.dumps([asdict(action) for action in actions])

    def deserialize_actions(self, raw_actions: list[str]) -> Iterator[Action]:
        for raw_action_group in raw_actions:
            action_group = json.loads(raw_action_group)
            for action in action_group:
                action_type = action.get('action')
                if action_type == 'upsert':
                    yield dacite.from_dict(UpsertAction, action, self.config)
                elif action_type == 'delete':
                    yield dacite.from_dict(DeleteAction, action, self.config)
                elif action_type == 'set-grid-type':
                    yield dacite.from_dict(SetGridTypeAction, action, self.config)
                else:
                    # Ignore unknown action types so that new action types do not break old
                    # servers
                    logger.warning(
                        'unknown action type encountered during deserialization',
                        extra={'action_type': action_type},
                    )
