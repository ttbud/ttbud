from typing import Iterable, Any


_SENTINEL = object()


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
    elif isinstance(expected, list):
        assert_all_match(actual, expected)
    else:
        assert actual == expected


def assert_all_match(actual: Iterable[Any], expected: Iterable[dict]) -> None:
    expected_iter = iter(expected)
    for actual_item in actual:
        assert_matches(actual_item, next(expected_iter, _SENTINEL))
    next_item = next(expected_iter, _SENTINEL)
    assert next_item is _SENTINEL, f'Missing item in iterable {next_item}'
