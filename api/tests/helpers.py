import asyncio
from typing import Iterable, Any, TypeVar, AsyncIterator

_SENTINEL = object()


def _is_iterable(instance: Any) -> bool:
    try:
        iter(instance)
        return True
    except TypeError:
        return False


def assert_matches(actual: Any, expected: Any) -> None:
    """Assert that all properties of expected exist on actual,
    and that the values for matching properties are equal.

    :param actual: The object that is being validated.
    :param expected: The expected object to compare actual to.
    """
    if isinstance(expected, dict):
        for k, v in expected.items():
            if isinstance(actual, dict):
                assert k in actual, f'Expected {actual} to have key "{k}"'
                assert_matches(actual[k], v)
            else:
                assert hasattr(actual, k), f'Expected {actual} to have attribute "{k}"'
                assert_matches(getattr(actual, k), v)
    elif _is_iterable(expected) and not isinstance(expected, str):
        try:
            expected_iter = iter(expected)
            for actual_item in actual:
                assert_matches(actual_item, next(expected_iter, _SENTINEL))
            next_item = next(expected_iter, _SENTINEL)
            assert next_item is _SENTINEL, f'Missing item in iterable {next_item}'
        except AssertionError as e:
            raise AssertionError(f"actual = '{actual}', expected = '{expected}'") from e
    else:
        assert actual == expected


T = TypeVar('T')


async def to_async(it: Iterable[T]) -> AsyncIterator[T]:
    for item in it:
        yield item


async def to_async_until(it: Iterable[T], stop: asyncio.Event) -> AsyncIterator[T]:
    for item in it:
        yield item
    await stop.wait()
