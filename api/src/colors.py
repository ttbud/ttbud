from dataclasses import dataclass


@dataclass
class Color:
    red: int
    green: int
    blue: int

    def __init__(self, red, green, blue):
        if not (0 <= red <= 255 and 0 <= green <= 255 and 0 <= blue <= 255):
            raise ValueError('RGB values must be between 0 and 255')
        self.red = red
        self.green = green
        self.blue = blue


colors = [
    Color(255, 0, 0),
    Color(0, 255, 0),
    Color(0, 0, 255),
    Color(255, 255, 0),
    Color(0, 255, 255),
    Color(255, 0, 255),
    Color(128, 0, 0),
    Color(0, 128, 0),
    Color(0, 0, 128),
    Color(128, 128, 0),
    Color(0, 128, 128),
    Color(128, 0, 128),
    Color(128, 128, 128),
]
