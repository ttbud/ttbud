from typing import NoReturn


def assert_never(x: NoReturn) -> NoReturn:
    assert False, f'Unhandled type: {type(x)}'