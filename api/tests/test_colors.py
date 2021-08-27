from typing import Tuple

import pytest

from src.colors import Color


@pytest.mark.parametrize("values", [(256, 0, 0), (1, 1, -1)])
def test_invalid_colors(values: Tuple[int, int, int]) -> None:
    with pytest.raises(ValueError):
        Color(*values)
