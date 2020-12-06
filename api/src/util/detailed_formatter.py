import traceback
from logging import LogRecord
from types import TracebackType
from typing import Dict, List, Optional

from timber.formatter import TimberFormatter

MAX_LOG_STACK_DEPTH = 20


def _jsonable_traceback(tb: Optional[TracebackType]) -> List[Dict[str, str]]:
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
        return super().format(record)
