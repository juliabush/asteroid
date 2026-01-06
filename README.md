# Asteroids Python + Pygame Arcade Game

A modern take on the classic Asteroids arcade game, built with Python and Pygame.

The game runs a headless Pygame simulation on the server and streams real-time game state to a browser client over WebSockets.

Navigate your ship, make sure to dodge asteroids, and fight back by shooting them down!

## How to play?

**Keys for navigation:**

- W/S -- Move forward/backward
- A/D -- Rotate ship
- SPACE -- Shoot

**Objective:**

- Avoid the asteroids -- one collision means GAME OVER!

### Architecture & Tech Stack

Backend: Python (Pygame for game simulation) with WebSockets
Frontend: Vanilla JavaScript, HTML5 Canvas, and CSS

Infrastructure:

**Backend**

- Hosted on AWS EC2
- Dockerized services
- Caddy as reverse proxy

**Frontend**

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
players[websocket] = Player(640, 360)
player_inputs[websocket] = {
    "up": False,
    "down": False,
    "left": False,
    "right": False,
    "space": False,
}

```

This snippet shows a new `Player` instance being created for every WebSocket connection at coordinates `(640, 360)`, which corresponds to the center of the game world. The second line initializes a per-player input state, allowing each connected client to control their own ship independently without interfering with other players. This allows for multiplayer behavior with a shared game loop for a collaborative game play.

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
<!-- python backend/server.py -->
<!-- WS.socket = new WebSocket("ws://localhost:8000"); -->
