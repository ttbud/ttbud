import json
import random
import ssl
import time
import uuid
from dataclasses import asdict
from typing import List, Optional

from locust import User, task, between
from locust.env import Environment
from websocket import create_connection, WebSocket

from src.api.api_structures import (
    Request,
    CreateOrUpdateAction,
    PingAction,
    DeleteAction,
    Action,
)
from src.game_components import Ping, Token, IconTokenContents

CONNECTION_TIMEOUT_SECONDS = 10


def milliseconds_since(time_seconds: float) -> int:
    return int((time.time() - time_seconds) * 1000)


class TTBudClient:
    def __init__(self, locust_env: Environment, room_id: str):
        self._ttbud_addr = f'{locust_env.host}/{room_id}'
        self._locust = locust_env
        self._ws: Optional[WebSocket] = None

    def connect(self) -> None:
        start_time = time.time()
        try:
            self._ws = create_connection(
                self._ttbud_addr,
                timeout=CONNECTION_TIMEOUT_SECONDS,
                sslopt={'cert_reqs': ssl.CERT_NONE},
            )
            # Wait for first connection message
            self._ws.recv()
        except Exception as e:
            self._locust.events.request_failure.fire(
                request_type='websocket',
                name='connect',
                response_time=milliseconds_since(start_time),
                exception=e,
                response_length=0,
            )
            raise e
        else:
            self._locust.events.request_success.fire(
                request_type='websocket',
                name='connect',
                response_time=milliseconds_since(start_time),
                response_length=0,
            )

    def disconnect(self) -> None:
        if self._ws:
            self._ws.close()

    @task
    def send(self, request: Request) -> None:
        if not self._ws:
            raise RuntimeError('ws not set up, connect was not called before send')
        start_time = time.time()
        try:
            self._ws.send(json.dumps(asdict(request)))
            while True:
                raw_resp = self._ws.recv()
                resp = json.loads(raw_resp)
                if resp['request_id'] == request.request_id:
                    break
        except Exception as e:
            self._locust.events.request_failure.fire(
                request_type='websocket',
                name='update',
                response_time=milliseconds_since(start_time),
                exception=e,
                response_length=0,
            )
        else:
            self._locust.events.request_success.fire(
                request_type='websocket',
                name='update',
                response_time=milliseconds_since(start_time),
                response_length=0,
            )


class TTBudUser(User):
    wait_time = between(0.5, 2)

    def __init__(self, environment: Environment):
        super().__init__(environment)
        self.client = TTBudClient(environment, str(uuid.uuid4()))
        self.tokens_ids_sent: List[str] = []

    def on_start(self) -> None:
        self.client.connect()

    def on_stop(self) -> None:
        # Delete all the tokens from the room to avoid saving load test rooms
        # to the store
        updates: List[Action] = list(
            map(
                lambda token_id: DeleteAction(action='delete', data=token_id),
                self.tokens_ids_sent,
            )
        )
        self.client.send(Request(request_id=str(uuid.uuid4()), updates=updates))
        self.client.disconnect()

    @task(10)
    def add_token(self) -> None:
        start_x = random.randint(0, 400)
        start_y = random.randint(0, 400)
        start_z = random.randint(0, 400)

        self.client.send(
            Request(
                str(uuid.uuid4()),
                updates=[
                    CreateOrUpdateAction(
                        'create',
                        Token(
                            id=str(uuid.uuid4()),
                            type='character',
                            contents=IconTokenContents('load_test_icon_id'),
                            start_x=start_x,
                            start_y=start_y,
                            start_z=start_z,
                            end_x=start_x + 1,
                            end_y=start_y + 1,
                            end_z=start_z + 1,
                        ),
                    )
                ],
            )
        )

    @task(1)
    def ping(self) -> None:
        self.client.send(
            Request(
                str(uuid.uuid4()),
                updates=[
                    PingAction('ping', Ping(str(uuid.uuid4()), type='ping', x=1, y=1))
                ],
            )
        )
