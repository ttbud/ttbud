import os

from wsmanager import start_websocket


def main():
    websocket_port = int(os.environ['API_WEBSOCKET_PORT'])
    room_store_dir = os.environ['ROOM_STORE_DIR']

    start_websocket(websocket_port, room_store_dir)


if __name__ == '__main__':
    main()
