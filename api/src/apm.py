from typing import ContextManager

import scout_apm.api


def transaction(transaction_name: str) -> ContextManager:
    """
    Create a tracked apm transaction context

    Example:
    >>> with transaction("hard work transaction"):
    >>>     print("Doing hard work")

    :return: A context manager that will automatically end the transaction
    when exited
    """
    return scout_apm.api.WebTransaction(transaction_name)
