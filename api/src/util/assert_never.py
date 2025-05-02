from typing import NoReturn


def assert_never(x: NoReturn) -> NoReturn:
    """This function tells mypy that the branch that called it should never execute
    It can be used to tell mypy to force that branches before this must cover all cases
    (Such as checking all values in an enum or a discriminated union)
    """
    # pragma: no coverage
    raise AssertionError(f'Unhandled type: {type(x)}')
