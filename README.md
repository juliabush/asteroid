# Asteroids Python + Pygame Arcade Game

A modern take on the classic Asteroids arcade game, built with Python and Pygame.

The game runs a headless Pygame simulation on the server and streams real-time game state to a browser client over WebSockets.

Navigate your ship, make sure to dodge asteroids, and fight back by shooting them down!

## How to play?

Keys for navigation:
~ W/S - Move forward/backward
~ A/D - Rotate ship
~ SPACE - Shoot
~ Avoid the steroids - one collision means GAME OVER!

### Architecture & Tech Stack

Backend: Python (Pygame for game simulation) with WebSockets
Frontend: Vanilla JavaScript, HTML5 Canvas, and CSS

Infrastructure:

** Backend **

- Hosted on AWS EC2
- Dockerized services
- Caddy as reverse proxy

  ** Frontend **

- Deployed on Vercel

#### Key Technical Takeaways

Here are some code snippets that emphasize specific implementation choices.

```Python
os.environ["SDL_VIDEODRIVER"] = "dummy"
screen = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
```

This snippet shows how the program is configured to run without a GUI so it remains compatible with the browser-based frontend and cloud services used to host it. `os.environ` is a mapping of environment variables, and `SDL_VIDEODRIVER` is read by Pygame at startup. Setting this variable to `"dummy"` forces Pygame into a headless state.

The second line initializes the `screen` variable as an in-memory `pygame.Surface` with the given dimensions, which is not attached to any window or display.

```Python
dt = 1 / 60

while True:
    if game_phase == PHASE_RUNNING:
        ...
        status = run_game_step(dt)

    if connected_clients:
        msg = json.dumps({
            "type": "state",
            "phase": game_phase,
            "data": state
        })
        await asyncio.gather(
            *(c.send(msg) for c in connected_clients),
            return_exceptions=True
        )

    await asyncio.sleep(dt)
```

This snippet starts by defining `dt` as delta time, representing the duration of one simulation step. At `1 / 60`, each step is approximately 16.7 ms, which makes movement and updates frame-rate independent.

The `while True` creates an infinite loop that acts as the main game loop and runs for the lifetime of the server.

The `if game_phase == PHASE_RUNNING` conditional ensures that the simulation only updates while the game is active. Assigning `status` to the result of `run_game_step(dt)` advances the simulation for one tick, updating positions, handling collisions, and applying game rules.

The `if connected_clients` check ensures that state updates are only sent when at least one client is connected. The call to `json.dumps` serializes the current game state into JSON so it can be transmitted over the network. `await asyncio.gather` then sends the state update to all connected clients concurrently, allowing multiple asynchronous send operations to run at the same time.

Finally, `await asyncio.sleep(dt)` pauses the loop for `dt` seconds, capping the loop at roughly 60 iterations per second while also allowing other asynchronous tasks, such as network I/O, to execute.

```JavaScript
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState) {
    const [px, py] = gameState.player;
    ...
  }

  requestAnimationFrame(render);
}
```

This snippet from the client-side code defines the `render` function, which is responsible for drawing a single frame. It is called repeatedly to animate the game. `ctx` is the 2D rendering context of the canvas and provides built-in drawing methods. The `clearRect` method clears the entire canvas at the start of each frame to prevent previous frames from persisting on screen.

The conditional check on `gameState` ensures that rendering only occurs after the client has received state data from the server. Before the first WebSocket message arrives, `gameState` is `null`, and this guard prevents errors from attempting to access undefined data.

Finally, `requestAnimationFrame(render)` schedules the function to run again before the next browser repaint, creating a continuous render loop synchronized with the display refresh rate.

<!-- source .venv/bin/activate -->
<!-- python -m backend.server -->
