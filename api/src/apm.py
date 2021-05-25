from typing import ContextManager, Callable, Any, TypeVar, cast, overload, Union

import scout_apm.api

F = TypeVar('F', bound=Callable[..., Any])

InstrumentType = Callable[[F], F]


@overload
def instrument(func_or_name: F) -> F:
    ...


@overload
def instrument(func_or_name: str) -> ContextManager:
    ...


def instrument(func_or_name: Union[F, str]) -> Union[F, ContextManager]:
    """Measure function or block execution time in scout for the current transaction"""

    if callable(func_or_name):
        func = cast(F, func_or_name)

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with scout_apm.api.instrument(func.__qualname__):
                return func(*args, **kwargs)

        return cast(F, wrapper)
    else:
        return scout_apm.api.instrument(func_or_name)


def foreground_transaction(transaction_name: str) -> ContextManager:
    """
    Create a tracked apm transaction context for foreground work

    Example:
    >>> with foreground_transaction("hard work transaction"):
    >>>     print("Doing hard work")

    :return: A context manager that will automatically end the transaction
    when exited
    """
    return scout_apm.api.WebTransaction(transaction_name)


def background_transaction(transaction_name: str) -> ContextManager:
    """
    Create a tracked apm transaction context for background work

    Example:
    >>> with background_transaction("hard work transaction"):
    >>>     print("Doing hard work")

    :return: A context manager that will automatically end the transaction
    when exited
    """
    return scout_apm.api.BackgroundTransaction(transaction_name)
