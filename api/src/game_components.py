from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class Token:
    id: str
    type: str
    icon_id: str
    start_x: int
    start_y: int
    start_z: int
    end_x: int
    end_y: int
    end_z: int
    color_rgb: Optional[Tuple[int, int, int]] = None


@dataclass
class Ping:
    id: str
    type: str
    x: int
    y: int
