from game_state_server import GameStateServer, UNIT_SIZE, Token


test_token = {
    'id': 'valid-id',
    'icon_id': 'valid_icon_id',
    'start_x': 0,
    'start_y': 0,
    'start_z': 0,
    'end_x': UNIT_SIZE,
    'end_y': UNIT_SIZE,
    'end_z': UNIT_SIZE,
}


def test_validate_token():

    valid_token = Token(**test_token)
    assert GameStateServer.validate_token(valid_token) is True

    invalid_token = Token(**test_token)
    invalid_token.start_x = 2 * UNIT_SIZE
    assert GameStateServer.validate_token(invalid_token) is False


def test_get_unit_blocks():

    valid_token = Token(**test_token)
    assert GameStateServer.get_unit_blocks(valid_token) == [(0, 0, 0)]

    valid_token.end_x = UNIT_SIZE * 2
    valid_token.end_y = UNIT_SIZE * 2
    valid_token.end_z = UNIT_SIZE * 2
    blocks = GameStateServer.get_unit_blocks(valid_token)
    assert (0, 0, 0) in blocks
    assert (UNIT_SIZE, 0, 0) in blocks
    assert (0, UNIT_SIZE, 0) in blocks
    assert (0, 0, UNIT_SIZE) in blocks
    assert (UNIT_SIZE, UNIT_SIZE, 0) in blocks
    assert (UNIT_SIZE, 0, UNIT_SIZE) in blocks
    assert (0, UNIT_SIZE, UNIT_SIZE) in blocks
    assert (UNIT_SIZE, UNIT_SIZE, UNIT_SIZE) in blocks
