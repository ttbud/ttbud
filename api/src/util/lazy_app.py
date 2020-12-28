import sys
from typing import Dict, Any

from gunicorn.app.base import BaseApplication
from starlette.types import ASGIApp

from src.util.lazy_asgi import AppFactory, LazyASGI


class LazyApp(BaseApplication):
    def __init__(self, app_factory: AppFactory, config: Dict[str, Any]):
        self._config = config
        self._app_factory = app_factory
        super(LazyApp, self).__init__()

    def load_config(self) -> None:
        for k, v in self._config.items():
            try:
                self.cfg.set(k.lower(), v)
            except AttributeError:
                print("Invalid value for %s: %s\n" % (k, v), file=sys.stderr)
                sys.stderr.flush()
                raise

    def load(self) -> ASGIApp:
        return LazyASGI(self._app_factory)
