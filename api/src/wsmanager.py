import asyncio
import queue
import socket

import websockets


class WebsocketManager:

    def __init__(self, send_q, receive_q, host, port):

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._connections = set()
        self._q = queue.Queue()
        self.host = host
        self.port = port
        self.send_q = send_q
        self.receive_q = receive_q

    def start_server(self):

        try:
            ws_server = websockets.serve(
                self.consumer_handler,
                self.host,
                self.port,
            )

            asyncio.ensure_future(self.producer_handler())
            self._loop.run_until_complete(ws_server)
        except OSError as e:
            print(e)
        else:
            self._loop.run_forever()

    async def consumer_handler(self, websocket, path):

        self._connections.add(websocket)
        print(path)
        try:
            async for message in websocket:
                await self.consume(message)
        finally:
            self._connections.remove(websocket)

    async def producer_handler(self):

        while True:
            try:
                message = self.send_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.0001)          # Induced delay to free up event loop
                continue
            if message is not None and self._connections:
                print(message)
                await asyncio.wait([client.send(message) for client in self._connections])

    async def consume(self, json_message):

        self.receive_q.put(json_message)


def main(send_q, receive_q, host_ip, host_port):

    ws = WebsocketManager(send_q, receive_q, host_ip, host_port)
    ws.start_server()
