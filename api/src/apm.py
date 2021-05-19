from typing import ContextManager

import scout_apm.api


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
