from src.apm import ApmTransaction


class FakeApmTransaction(ApmTransaction):
    def __enter__(self):
        pass

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def fake_transaction(transaction_name: str) -> ApmTransaction:
    """
    A fake APM transaction that does nothing

    Example:
    >>> with fake_transaction("hard work transaction"):
    >>>     print("Doing hard work")

    :return: A context manager that will automatically end the transaction
    when exited
    """
    return FakeApmTransaction()
