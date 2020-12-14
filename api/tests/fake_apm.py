from types import TracebackType
from typing import ContextManager, Optional, Type


class FakeApmTransaction(ContextManager):
    def __enter__(self) -> None:
        pass

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        pass


def fake_transaction(transaction_name: str) -> ContextManager:
    """
    A fake APM transaction that does nothing

    Example:
    >>> with fake_transaction("hard work transaction"):
    >>>     print("Doing hard work")

    :return: A context manager that will automatically end the transaction
    when exited
    """
    return FakeApmTransaction()
