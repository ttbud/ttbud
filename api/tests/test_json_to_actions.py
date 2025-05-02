import json
from dataclasses import asdict

from src.room_store.json_to_actions import json_to_actions
from tests.static_fixtures import ANOTHER_VALID_ACTION, DELETE_VALID_TOKEN, VALID_ACTION


def test_json_to_actions() -> None:
    assert list(
        json_to_actions(
            [
                json.dumps([asdict(VALID_ACTION)]),
                json.dumps([asdict(DELETE_VALID_TOKEN)]),
                json.dumps([asdict(ANOTHER_VALID_ACTION)]),
            ]
        )
    ) == [VALID_ACTION, DELETE_VALID_TOKEN, ANOTHER_VALID_ACTION]


def test_convert_empty_list() -> None:
    assert list(json_to_actions([])) == []
