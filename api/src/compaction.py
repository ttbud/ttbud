import asyncio
from typing import List, NoReturn

from src.room import Room
from src.api.api_structures import UpsertAction, DeleteAction, Action
from src.game_components import Token
from src.room_store.room_store import (
    RoomStore,
    UnexpectedReplacementId,
    COMPACTION_INTERVAL_MINUTES,
)


class Compactor:
    def __init__(self, room_store: RoomStore, compaction_id: str):
        self._room_store = room_store
        self._compaction_id: str = compaction_id

    async def maintain_compaction(self) -> NoReturn:
        acquired = False
        while True:
            if not acquired:
                acquired = await self._room_store.acquire_replacement_lock(
                    self._compaction_id
                )

            if acquired:
                try:
                    async for room_id in self._room_store.get_all_room_ids():
                        await self._compact_room(room_id)
                except UnexpectedReplacementId:
                    acquired = False

            await asyncio.sleep(COMPACTION_INTERVAL_MINUTES * 60)

    async def _compact_room(self, room_id: str) -> None:
        replacement_data = await self._room_store.read_for_replacement(room_id)
        room = Room()
        for action in replacement_data.actions:
            if isinstance(action, UpsertAction):
                room.create_or_update_token(action.data)
            elif isinstance(action, DeleteAction):
                room.delete_token(action.data)
        compacted_actions = _tokens_to_actions(list(room.game_state.values()))
        await self._room_store.replace(
            room_id,
            compacted_actions,
            replacement_data.replace_token,
            self._compaction_id,
        )


def _tokens_to_actions(tokens: List[Token]) -> List[Action]:
    actions: List[Action] = []
    for token in tokens:
        actions.append(UpsertAction(token))
    return actions
