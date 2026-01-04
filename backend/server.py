import asyncio
import json
import websockets
from backend.main import game_loop, reset_game

connected_clients = set()

player_inputs = {
    "up": False,
    "down": False,
    "left": False,
    "right": False,
    "space": False,
    "restart": False
}

KEY_MAP = {
    "ArrowUp": "up", "w": "up",
    "ArrowDown": "down", "s": "down",
    "ArrowLeft": "left", "a": "left",
    "ArrowRight": "right", "d": "right",
    " ": "space",
}

game_task = None


async def handler(websocket):
    global game_task

    connected_clients.add(websocket)

    if not game_task or game_task.done():
        if len(connected_clients) == 1:
            game_task = asyncio.create_task(game_loop(connected_clients, player_inputs))

    try:
        await websocket.send(json.dumps({
            "type": "connection",
            "message": "Connected to Asteroids WebSocket server"
        }))

        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type in ("input", "input_release"):
                key = data.get("key")
                if key in KEY_MAP:
                    player_inputs[KEY_MAP[key]] = (msg_type == "input")

            elif msg_type == "restart":
                reset_game()

    except websockets.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)


async def main():
    async with websockets.serve(handler, "0.0.0.0", 8000):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
