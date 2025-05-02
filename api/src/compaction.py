import asyncio
import logging
import time
from typing import NoReturn

from src.api.api_structures import Action, UpsertAction
from src.apm import background_transaction
from src.game_components import Token
from src.room import create_room
from src.room_store.common import ARCHIVE_WHEN_IDLE_SECONDS, NoSuchRoomError
from src.room_store.room_archive import RoomArchive
from src.room_store.room_store import (
    COMPACTION_INTERVAL_SECONDS,
    RoomStore,
    UnexpectedReplacementId,
    UnexpectedReplacementToken,
)

_logger = logging.getLogger(__name__)


class Compactor:
    def __init__(
        self,
        room_store: RoomStore,
        room_archive: RoomArchive,
        compaction_id: str,
    ):
        self._room_store = room_store
        self._compaction_id = compaction_id
        self._room_archive = room_archive

    async def maintain_compaction(self) -> NoReturn:
        while True:
            if await self._room_store.acquire_replacement_lock(self._compaction_id):
                with background_transaction('compaction'):
                    start_time = time.monotonic()
                    try:
                        async for room_id in self._room_store.get_all_room_ids():
                            await self._compact_room(room_id)
                    except UnexpectedReplacementId:
                        _logger.info('Lost replacement lock while compacting')
                    _logger.info(
                        'Compaction cycle complete',
                        extra={'elapsed_time_secs': time.monotonic() - start_time},
                    )
            else:
                _logger.info('Failed to acquire compaction lock')

            await asyncio.sleep(COMPACTION_INTERVAL_SECONDS)

    async def _compact_room(self, room_id: str) -> None:
        replacement_data = await self._room_store.read_for_replacement(room_id)
        room = create_room(replacement_data.actions)
        compacted_actions = _tokens_to_actions(list(room.game_state.values()))
        try:
            room_idle_seconds = await self._room_store.get_room_idle_seconds(room_id)
        except NoSuchRoomError:
            _logger.warning(f'Room unexpectedly deleted during compaction: {room_id}')
            return

        if not compacted_actions:
            try:
                await asyncio.gather(
                    self._room_store.delete(
                        room_id, self._compaction_id, replacement_data.replace_token
                    ),
                    self._room_archive.delete(room_id),
                )
                return
            except UnexpectedReplacementToken:
                # Something was added to the room after we started compacting,
                # so just fall back to regular compacting
                pass

        elif room_idle_seconds >= ARCHIVE_WHEN_IDLE_SECONDS:
            await self._room_archive.write(room_id, compacted_actions)
            try:
                await self._room_store.delete(
                    room_id, self._compaction_id, replacement_data.replace_token
                )
                return
            except UnexpectedReplacementToken:
                # Something was added to the room after we started compacting,
                # so just fall back to regular compacting
                pass

        await self._room_store.replace(
            room_id,
            compacted_actions,
            replacement_data.replace_token,
            self._compaction_id,
        )


def _tokens_to_actions(tokens: list[Token]) -> list[Action]:
    actions: list[Action] = []
    for token in tokens:
        actions.append(UpsertAction(token))
    return actions
