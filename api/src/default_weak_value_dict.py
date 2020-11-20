import weakref
from typing import TypeVar, Callable, Any, Generic

Value = TypeVar('Value')


class DefaultWeakValueDict(weakref.WeakValueDictionary, Generic[Value]):
    def __init__(self, default_factory: Callable[[], Value]):
        super().__init__()
        self._default_factory: Callable[[], Value] = default_factory

    def __getitem__(self, item: Any) -> Value:
        try:
            return super().__getitem__(item)
        except KeyError:
            value = self[item] = self._default_factory()
            return value
