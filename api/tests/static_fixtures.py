from src.api.api_structures import (
    UpsertAction,
    DeleteAction,
    PingAction,
    Request,
)
from src.colors import colors
from src.game_components import Token, IconTokenContents, Ping

TEST_ROOM_ID = 'test_room'
TEST_CLIENT_ID = 'test_client'
TEST_REQUEST_ID = 'test_request'
BAD_REQUEST_ID = 'bad_request'
VALID_TOKEN = Token(
    'some_id',
    'character',
    IconTokenContents('some_icon_id'),
    start_x=0,
    start_y=0,
    start_z=0,
    end_x=1,
    end_y=1,
    end_z=1,
    color_rgb=colors[0],
)
VALID_TOKEN_WITH_DUPLICATE_COLOR = Token(
    'token_id',
    'character',
    IconTokenContents('some_icon_id'),
    start_x=1,
    start_y=1,
    start_z=1,
    end_x=2,
    end_y=2,
    end_z=2,
    color_rgb=colors[0],
)
ANOTHER_VALID_TOKEN = Token(
    'another_id',
    'character',
    IconTokenContents('another_icon_id'),
    start_x=1,
    start_y=1,
    start_z=1,
    end_x=2,
    end_y=2,
    end_z=2,
    color_rgb=colors[1],
)
VALID_PING = Ping('ping_id', 'ping', 0, 0)
UPDATED_TOKEN = Token(
    VALID_TOKEN.id,
    VALID_TOKEN.type,
    VALID_TOKEN.contents,
    7,
    8,
    9,
    8,
    9,
    10,
    colors[0],
)
VALID_ACTION = UpsertAction(data=VALID_TOKEN)
VALID_ACTION_WITH_DUPLICATE_COLOR = UpsertAction(data=VALID_TOKEN_WITH_DUPLICATE_COLOR)
DELETE_VALID_TOKEN = DeleteAction(data=VALID_TOKEN.id)
ANOTHER_VALID_ACTION = UpsertAction(data=ANOTHER_VALID_TOKEN)
PING_ACTION = PingAction(data=VALID_PING)
VALID_REQUEST = Request('request_id', [VALID_ACTION])
VALID_MOVE_REQUEST = Request('move_request_id', [UpsertAction(data=UPDATED_TOKEN)])
DELETE_REQUEST = Request('delete-request-id', [DELETE_VALID_TOKEN])
