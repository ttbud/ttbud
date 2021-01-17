import pytest

from src.colors import colors
from src.game_components import Token, IconTokenContents
from src.room import Room
from tests.static_fixtures import VALID_TOKEN


@pytest.fixture
def room() -> Room:
    return Room()


def test_create_valid_token(room: Room) -> None:
    room.create_or_update_token(VALID_TOKEN)
    assert list(room.game_state.values()) == [VALID_TOKEN]


def test_delete_token(room: Room) -> None:
    room.create_or_update_token(VALID_TOKEN)
    room.delete_token(VALID_TOKEN.id)
    assert list(room.game_state.values()) == []


def test_duplicate_position_rejected(room: Room) -> None:
    room.create_or_update_token(VALID_TOKEN)
    room.create_or_update_token(
        Token(
            id='conflicting_token',
            type='character',
            contents=IconTokenContents('some_icon'),
            start_x=VALID_TOKEN.start_x,
            start_y=VALID_TOKEN.start_y,
            start_z=VALID_TOKEN.start_z,
            end_x=VALID_TOKEN.end_x,
            end_y=VALID_TOKEN.end_y,
            end_z=VALID_TOKEN.end_z,
        )
    )
    assert list(room.game_state.values()) == [VALID_TOKEN]


def test_deleting_clears_position(room: Room) -> None:
    room.create_or_update_token(
        Token(
            id='first_token',
            type='character',
            contents=IconTokenContents('some_icon'),
            start_x=VALID_TOKEN.start_x,
            start_y=VALID_TOKEN.start_y,
            start_z=VALID_TOKEN.start_z,
            end_x=VALID_TOKEN.end_x,
            end_y=VALID_TOKEN.end_y,
            end_z=VALID_TOKEN.end_z,
        )
    )
    room.delete_token('first_token')
    room.create_or_update_token(VALID_TOKEN)
    assert list(room.game_state.values()) == [VALID_TOKEN]


def test_more_tokens_than_colors(room: Room) -> None:
    for i in range(len(colors) + 1):
        room.create_or_update_token(
            Token(
                id=f'token_{i}',
                type='character',
                contents=IconTokenContents('some_icon'),
                start_x=i,
                start_y=i,
                start_z=i,
                end_x=i + 1,
                end_y=i + 1,
                end_z=i + 1,
            )
        )
    tokens_without_color = []
    for token in list(room.game_state.values()):
        assert isinstance(token, Token)
        if not token.color_rgb:
            tokens_without_color.append(token)
    assert len(tokens_without_color) == 1
