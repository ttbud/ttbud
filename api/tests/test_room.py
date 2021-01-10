import pytest

from src.room import Room
from tests.static_fixtures import VALID_TOKEN


@pytest.fixture
def room() -> Room:
    return Room()


def test_create_valid_token(room: Room) -> None:
    room.create_or_update_token(VALID_TOKEN)
    assert list(room.game_state.values()) == [VALID_TOKEN]
