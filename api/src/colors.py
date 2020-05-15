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
    Color(255, 0, 0),  # Red
    Color(0, 228, 10),  # Green
    Color(0, 0, 255),  # Blue
    Color(253, 216, 53),  # Yellow
    Color(2, 213, 247),  # Cyan
    Color(255, 0, 255),  # Pink
    Color(94, 53, 177),  # Purple
    Color(0, 0, 0),  # Black
]
