import json
from collections.abc import Iterator

from dacite import from_dict

from src.api.api_structures import Action, DeleteAction, UpsertAction


def json_to_actions(raw_updates: list[str]) -> Iterator[Action]:
    for raw_update_group in raw_updates:
        update_group = json.loads(raw_update_group)
        for update in update_group:
            action = update['action']
            if action == 'upsert':
                yield from_dict(UpsertAction, update)
            elif action == 'delete':
                yield from_dict(DeleteAction, update)
