import traceback
from logging import LogRecord
from types import TracebackType

from timber.formatter import TimberFormatter

MAX_LOG_STACK_DEPTH = 20


def _jsonable_traceback(tb: TracebackType | None) -> list[dict[str, str | None]]:
    stack = traceback.extract_tb(tb, limit=MAX_LOG_STACK_DEPTH)
    return [
        {
            'file': frame.filename,
            'function': frame.name,
            'line_number': str(frame.lineno),
            'line': frame.line,
        }
        for frame in stack
    ]


_DEFAULT_KEYS = {
    'args',
    'asctime',
    'created',
    'exc_info',
    'exc_text',
    'filename',
    'funcName',
    'levelname',
    'levelno',
    'lineno',
    'module',
    'msecs',
    'message',
    'msg',
    'name',
    'pathname',
    'process',
    'processName',
    'relativeCreated',
    'thread',
    'threadName',
    'stack_info',
}


class DetailedFormatter(TimberFormatter):
    """TimberFormatter that includes exception stack traces"""

    def format(self, record: LogRecord) -> str:
        if record.exc_info:
            (typ, msg, tb) = record.exc_info
            record.__dict__['exception'] = {
                'type': typ.__name__ if typ else 'Unknown',
                'msg': str(msg),
                'traceback': _jsonable_traceback(tb),
            }

        # Skip keys that may not be json-encodable
        for key, value in list(record.__dict__.items()):
            if (
                key not in _DEFAULT_KEYS
                and value is not None
                and not isinstance(value, dict | str | int)
            ):
                del record.__dict__[key]

        return super().format(record)
