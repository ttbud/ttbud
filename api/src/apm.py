from typing import Protocol

import scout_apm.api


class ApmTransaction(Protocol):
    def __enter__(self):
        pass

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def transaction(transaction_name: str) -> ApmTransaction:
    """
    Create a tracked apm transaction context

    Example:
    >>> with transaction("hard work transaction"):
    >>>     print("Doing hard work")

    :return: A context manager that will automatically end the transaction
    when exited
    """
    return scout_apm.api.WebTransaction(transaction_name)
