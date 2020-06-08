from typing import Iterable, Any


_SENTINEL = object()


def assert_matches(actual: Any, expected: Any) -> None:
    """Assert that actual and expected are equal. Recursively evaluates
    dictionaries, and passes lists back to assert_all_match.

    :param actual: The object that is being validated.
    :param expected: The expected object to compare actual to.
    """
    if isinstance(expected, dict):
        for k, v in expected.items():
            assert hasattr(actual, k)
            assert_matches(getattr(actual, k), v)
    elif isinstance(expected, list):
        assert_all_match(actual, expected)
    else:
        assert actual == expected


def assert_all_match(actual: Iterable[Any], expected: Iterable[dict]) -> None:
    expected_iter = iter(expected)
    for actual_item in actual:
        assert_matches(actual_item, next(expected_iter, _SENTINEL))
    assert next(expected_iter, _SENTINEL) is _SENTINEL
