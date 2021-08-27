import pytest

from src.game_components import Token, TextTokenContents


def test_invalid_token_coords() -> None:
    with pytest.raises(ValueError):
        Token(
            id="id",
            type="character",
            contents=TextTokenContents(text="TF"),
            start_x=0,
            start_y=0,
            start_z=0,
            end_x=-1,
            end_y=1,
            end_z=1,
        )
