import asyncio
import json
import websockets
from backend.main import game_loop

connected_clients = set()

player_inputs = {
    "up": False,
    "down": False,
    "left": False,
    "right": False,
    "space": False,
    "restart": False
}


async def handler(websocket):
    """Handles each connected WebSocket client."""
    connected_clients.add(websocket)
    print(f"Client connected ({len(connected_clients)} total)")

    try:
        await websocket.send(json.dumps({
            "type": "connection",
            "message": "Connected to Asteroids WebSocket server"
        }))

        async for message in websocket:
            data = json.loads(message)
            print(f"Received: {data}")

            if data.get("type") == "input":
                key = data.get("key")
                if key in ["ArrowUp", "w"]:
                    player_inputs["up"] = True
                elif key in ["ArrowDown", "s"]:
                    player_inputs["down"] = True
                elif key in ["ArrowLeft", "a"]:
                    player_inputs["left"] = True
                elif key in ["ArrowRight", "d"]:
                    player_inputs["right"] = True
                elif key == " ":
                    player_inputs["space"] = True

            elif data.get("type") == "input_release":
                key = data.get("key")
                if key in ["ArrowUp", "w"]:
                    player_inputs["up"] = False
                elif key in ["ArrowDown", "s"]:
                    player_inputs["down"] = False
                elif key in ["ArrowLeft", "a"]:
                    player_inputs["left"] = False
                elif key in ["ArrowRight", "d"]:
                    player_inputs["right"] = False
                elif key == " ":
                    player_inputs["space"] = False

            elif data.get("type") == "restart":
                player_inputs["restart"] = True

            print("Current player_inputs:", player_inputs)

    except websockets.ConnectionClosed:
        print("Client disconnected")
    finally:
        connected_clients.remove(websocket)
        print(f"Client removed ({len(connected_clients)} remaining)")


async def main():
    """Starts the WebSocket server and runs the game loop."""
    async with websockets.serve(handler, "0.0.0.0", 8000):
        print("WebSocket server running on ws://0.0.0.0:8000")

        asyncio.create_task(game_loop(connected_clients, player_inputs))

        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
