import json
from collections.abc import Iterator
from enum import Enum

from dacite import Config, from_dict

from src.api.api_structures import (
    Action,
    DeleteAction,
    SetGridTypeAction,
    UpsertAction,
)

DACITE_CONFIG = Config(cast=[Enum])


def json_to_actions(raw_updates: list[str]) -> Iterator[Action]:
    for raw_update_group in raw_updates:
        update_group = json.loads(raw_update_group)
        for update in update_group:
            action = update['action']
            if action == 'upsert':
                yield from_dict(UpsertAction, update, DACITE_CONFIG)
            elif action == 'delete':
                yield from_dict(DeleteAction, update, DACITE_CONFIG)
            elif action == 'set-grid-type':
                yield from_dict(SetGridTypeAction, update, DACITE_CONFIG)
