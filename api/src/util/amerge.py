from __future__ import annotations

import asyncio
from dataclasses import dataclass
from enum import Enum
from typing import (
    AsyncIterator,
    TypeVar,
    Generic,
)

from src.util.async_util import anext

_T = TypeVar('_T')


class CompleteCondition(Enum):
    FIRST_COMPLETED = 'FIRST_COMPLETED'
    """Complete the merged iterator as soon as any of the child iterators are
    complete"""
    ALL_COMPLETED = 'ALL_COMPLETED'
    """Complete the merged iterator after all child iterators are complete"""


@dataclass
class _IterationResult(Generic[_T]):
    value: _T
    iter: AsyncIterator[_T]


class _IterationEnded(Exception):
    def __init__(self, iterator: AsyncIterator):
        self.iter = iterator


def _next_task(it: AsyncIterator[_T]) -> asyncio.Task[_IterationResult[_T]]:
    async def wait_for_result() -> _IterationResult[_T]:
        try:
            value = await anext(it)
        except StopAsyncIteration:
            raise _IterationEnded(it)
        return _IterationResult(value, it)

    return asyncio.create_task(wait_for_result())


async def amerge(
    *iterators: AsyncIterator[_T],
    complete_when: CompleteCondition = CompleteCondition.ALL_COMPLETED,
) -> AsyncIterator[_T]:
    """
    Iterate through `iterators` concurrently and yield items as they arrive
    :param iterators: The async iterators to be combined
    :param complete_when: When to finished the merged iterator
    :return:
    """
    # Map of iterables to a task to fetch their next result
    next_task_by_iter = {it: _next_task(it) for it in iterators}

    try:
        while next_task_by_iter:
            done, _ = await asyncio.wait(
                next_task_by_iter.values(), return_when=asyncio.FIRST_COMPLETED
            )

            for task in done:
                try:
                    result = task.result()
                    yield result.value
                except _IterationEnded as e:
                    if complete_when == CompleteCondition.ALL_COMPLETED:
                        del next_task_by_iter[e.iter]
                    else:
                        return
                else:
                    next_task_by_iter[result.iter] = _next_task(result.iter)
    finally:
        for task in next_task_by_iter.values():
            task.cancel()
