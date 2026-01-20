import asyncio
import json
import websockets

from main import game_loop, client_worlds
from player import Player

connected_clients = set()

players = {}
player_inputs = {}

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

    players[websocket] = Player(640, 360)
    player_inputs[websocket] = {
        "up": False,
        "down": False,
        "left": False,
        "right": False,
        "space": False,
    }

    if not game_task or game_task.done():
        if len(connected_clients) == 1:
            reset_game(players, player_inputs)
            game_task = asyncio.create_task(
                game_loop(connected_clients, players, player_inputs)
            )

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
                    player_inputs[websocket][KEY_MAP[key]] = (
                        msg_type == "input"
                    )

            elif msg_type == "resize":
                player_inputs[websocket]["_resize"] = {
                    "width": data["width"],
                    "height": data["height"],
                }

            elif msg_type == "restart":
                reset_game(players, player_inputs)

    except websockets.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        players.pop(websocket, None)
        player_inputs.pop(websocket, None)
        client_worlds.pop(websocket, None)


async def main():
    async with websockets.serve(handler, "0.0.0.0", 8000):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
