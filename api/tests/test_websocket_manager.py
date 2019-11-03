from src.wsmanager import WebsocketManager, UNIT_SIZE


class Token:
    """Creates a token for testing purposes. Defaults to a valid token"""
    def __init__(self, id='valid-id', icon='path/to/icon', start_x=0, start_y=0, start_z=0,
                 end_x=UNIT_SIZE, end_y=UNIT_SIZE, end_z=UNIT_SIZE):

        self.id = id
        self.icon = icon
        self.start_x = start_x
        self.start_y = start_y
        self.start_z = start_z
        self.end_x = end_x
        self.end_y = end_y
        self.end_z = end_z

    def to_dict(self):

        return {'id': self.id,
                'icon': self.icon,
                'start_x': self.start_x,
                'start_y': self.start_y,
                'start_z': self.start_z,
                'end_x': self.end_x,
                'end_y': self.end_y,
                'end_z': self.end_z,
                }


def test_validate_token():

    wm = WebsocketManager(None, 'localhost', 5555)
    valid_token = Token().to_dict()
    assert wm.validate_token(valid_token) is True

    invalid_token = Token(start_x=50, end_x=0).to_dict()
    assert wm.validate_token(invalid_token) is False

    invalid_token = Token().to_dict()
    del invalid_token['id']
    assert wm.validate_token(invalid_token) is False


def test_get_unit_blocks():

    wm = WebsocketManager(None, 'localhost', 5555)
    valid_token = Token().to_dict()
    assert wm.get_unit_blocks(valid_token) == [(0, 0, 0)]

    valid_token['end_x'] = UNIT_SIZE * 2
    valid_token['end_y'] = UNIT_SIZE * 2
    valid_token['end_z'] = UNIT_SIZE * 2
    blocks = wm.get_unit_blocks(valid_token)
    assert (0, 0, 0) in blocks
    assert (UNIT_SIZE, 0, 0) in blocks
    assert (0, UNIT_SIZE, 0) in blocks
    assert (0, 0, UNIT_SIZE) in blocks
    assert (UNIT_SIZE, UNIT_SIZE, 0) in blocks
    assert (UNIT_SIZE, 0, UNIT_SIZE) in blocks
    assert (0, UNIT_SIZE, UNIT_SIZE) in blocks
    assert (UNIT_SIZE, UNIT_SIZE, UNIT_SIZE) in blocks
