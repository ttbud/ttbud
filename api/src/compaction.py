import asyncio
from typing import List, NoReturn
from uuid import uuid4

from room import Room
from src.api.api_structures import UpsertAction, DeleteAction, Request, Action
from src.game_components import Token
from src.room_store.room_store import RoomStore

COMPACTION_INTERVAL_MINUTES = 10


class Compactor:
    def __init__(self, room_store: RoomStore):
        self._room_store = room_store

    async def maintain_compaction(self) -> NoReturn:
        while True:
            async for room_id in self._room_store.get_all_room_ids():
                await self.compact_room(room_id)
            await asyncio.sleep(COMPACTION_INTERVAL_MINUTES * 60)

    async def compact_room(self, room_id: str) -> None:
        replacement_data = await self._room_store.read_for_replacement(room_id)
        room = Room()
        for action in replacement_data.actions:
            if isinstance(action, UpsertAction):
                room.create_or_update_token(action.data)
            elif isinstance(action, DeleteAction):
                room.delete_token(action.data)
        compacted_actions = _tokens_to_actions(list(room.game_state.values()))
        request = Request(str(uuid4()), compacted_actions)
        await self._room_store.replace(room_id, request, replacement_data.replace_token)


def _tokens_to_actions(tokens: List[Token]) -> List[Action]:
    actions: List[Action] = []
    for token in tokens:
        actions.append(UpsertAction(token))
    return actions
