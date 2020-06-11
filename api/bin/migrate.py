import asyncio
from dataclasses import dataclass
from traceback import print_exc
from typing import Optional

from dacite import from_dict

from src.config import config
from src.colors import Color
from src.game_components import Token as V2Token, IconTokenContents
from src.room_store import FileRoomStore

store = FileRoomStore(config.room_store_dir)


@dataclass
class V1Token:
    id: str
    type: str
    icon_id: str
    start_x: int
    start_y: int
    start_z: int
    end_x: int
    end_y: int
    end_z: int
    color_rgb: Optional[Color] = None


def v1_to_v2(old: V1Token) -> V2Token:
    return V2Token(
        id=old.id,
        type=old.type,
        contents=IconTokenContents(old.icon_id),
        start_x=old.start_x,
        start_y=old.start_y,
        start_z=old.start_z,
        end_x=old.start_x,
        end_y=old.end_y,
        end_z=old.end_z,
        color_rgb=old.color_rgb,
    )


async def migrate() -> None:
    async for room_id in store.get_all_room_ids():
        room_data = await store.read_room_data(room_id)
        if room_data:
            try:
                new_tokens = []
                for token_dict in room_data:
                    old_token = from_dict(V1Token, token_dict)
                    new_tokens.append(v1_to_v2(old_token))
                await store.write_room_data(room_id, new_tokens)
            except Exception as e:
                print_exc()
                print('failed to migrate room', room_id, e)


if __name__ == '__main__':
    asyncio.get_event_loop().run_until_complete(migrate())
