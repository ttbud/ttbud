from typing import TypeVar, AsyncIterable, AsyncIterator, Optional, List

_T = TypeVar('_T')


async def anext(iterator: AsyncIterator[_T]) -> _T:
    """
    Retrieve the next item from the `iterator`.
    If the iterator is exhausted, StopIteration is raised.
    """
    return await iterator.__anext__()


async def async_collect(
    iterator: AsyncIterable[_T], count: Optional[int] = None
) -> List[_T]:
    """
    Collect `count` items from `iterator` and return it as a list.

    If `count` is not specified, all items in `iterator` will be collected
    """
    rtn = []
    if count == 0:
        raise ValueError('Must collect at least one item')

    async for item in iterator:
        rtn.append(item)
        if count is not None and len(rtn) >= count:
            break

    return rtn
