import asyncio
import json
import websockets
import main

from main import game_loop, create_world
from main import PHASE_RUNNING, PHASE_GAME_OVER
from player import Player

connected_clients = set()
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

    main.world["phase"] = PHASE_RUNNING

    w, h = main.world["size"]
    p = Player(w / 2, h / 2 + 250)
    p.shot_cooldown = 0
    p.fire_held = False
    main.world["players"][websocket] = p

    player_inputs[websocket] = {
        "up": False,
        "down": False,
        "left": False,
        "right": False,
        "space": False,
    }

    await websocket.send(json.dumps({
        "type": "init",
        "playerId": id(websocket)
    }))

    if not game_task or game_task.done():
        game_task = asyncio.create_task(
            game_loop(connected_clients, player_inputs)
        )

    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type in ("input", "input_release"):
                key = data.get("key")
                if key in KEY_MAP:
                    player_inputs[websocket][KEY_MAP[key]] = (
                        msg_type == "input"
                    )

            elif msg_type == "set_nickname":
                nickname = data.get("nickname", "").strip()
                if websocket in main.world["players"]:
                    main.world["players"][websocket].nickname = nickname

            elif msg_type == "restart":
                if main.world["phase"] != PHASE_GAME_OVER:
                    return

                size = main.world["size"]
                create_world(*size)
                main.world["phase"] = PHASE_RUNNING

                for ws in connected_clients:
                    p = Player(size[0] / 2, size[1] / 2 + 250)
                    p.shot_cooldown = 0
                    p.fire_held = False
                    main.world["players"][ws] = p

    except websockets.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        main.world["players"].pop(websocket, None)
        player_inputs.pop(websocket, None)


async def run_server():
    create_world(1600, 900)
    async with websockets.serve(handler, "0.0.0.0", 8000):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(run_server())
