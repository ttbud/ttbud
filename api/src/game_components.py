from dataclasses import dataclass
from typing import Literal

from .colors import Color


@dataclass
class TextTokenContents:
    text: str


@dataclass
class IconTokenContents:
    icon_id: str


TokenContents = TextTokenContents | IconTokenContents


@dataclass
class Token:
    id: str
    type: Literal['character', 'floor']
    contents: TokenContents
    start_x: int
    start_y: int
    start_z: int
    end_x: int
    end_y: int
    end_z: int
    color_rgb: Color | None = None

    def __post_init__(self) -> None:
        if (
            self.start_x >= self.end_x
            or self.start_y >= self.end_y
            or self.start_z >= self.end_z
        ):
            raise ValueError(
                f'Start coordinates must be less than end positions:'
                f' start=({self.start_x}, {self.start_y}, {self.start_z})'
                f' end=({self.end_x}, {self.end_y}, {self.end_z})'
            )


@dataclass
class Ping:
    id: str
    type: Literal['ping']
    x: int
    y: int


def content_id(contents: TokenContents) -> str:
    if isinstance(contents, TextTokenContents):
        return f'text-{contents.text}'
    elif isinstance(contents, IconTokenContents):
        return f'icon-{contents.icon_id}'
    else:
        raise ValueError(f'Unknown contents class type {type(contents)}')
