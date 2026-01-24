const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const modal = document.getElementById("gameOverModal");

const instructionsBtn = document.getElementById("instructionsBtn");
const instructionsModal = document.getElementById("instructionsModal");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

const helpBtn = document.getElementById("helpBtn");
helpBtn.style.display = "block";

let gameState = null;
document.body.style.margin = "0";
document.body.style.overflow = "hidden";

canvas.focus();

let WORLD_WIDTH = window.innerWidth;
let WORLD_HEIGHT = window.innerHeight;

const WS = {
  socket: null,
  connected: false,
  reconnectTimer: null,
};

function send(type, payload = {}) {
  if (!WS.socket || WS.socket.readyState !== WebSocket.OPEN) return;
  WS.socket.send(JSON.stringify({ type, ...payload }));
}

function connect() {
  if (WS.socket && WS.socket.readyState === WebSocket.OPEN) return;

  // WS.socket = new WebSocket("wss://juliabush.pl/ws");
  WS.socket = new WebSocket("ws://localhost:8000");

  WS.socket.onopen = () => {
    WS.connected = true;
    statusEl.textContent = "Connected";
    clearTimeout(WS.reconnectTimer);
  };

  WS.socket.onclose = () => {
    WS.connected = false;
    statusEl.textContent = "Disconnected";
    WS.reconnectTimer = setTimeout(connect, 2000);
  };

  WS.socket.onmessage = (e) => {
    handleMessage({ data: e.data });
  };
}

function handleMessage(event) {
  const msg = JSON.parse(event.data);

  if (msg.world) {
    WORLD_WIDTH = msg.world[0];
    WORLD_HEIGHT = msg.world[1];
  }

  if (msg.type === "state") {
    gameState = msg.data;

    const isGameOver = msg.phase === "game_over";
    modal.style.display = isGameOver ? "block" : "none";
    helpBtn.style.display = isGameOver ? "none" : "block";
  }
}

window.addEventListener("keydown", (e) => {
  e.preventDefault();
  send("input", { key: e.key });
});

window.addEventListener("keyup", (e) => {
  e.preventDefault();
  send("input_release", { key: e.key });
});

function openInstructions() {
  instructionsModal.style.display = "block";
  document.body.classList.add("modal-open");
}

function closeInstructions() {
  instructionsModal.style.display = "none";
  document.body.classList.remove("modal-open");
}
restartBtn.addEventListener("click", () => {
  send("restart");
});

instructionsBtn.addEventListener("click", openInstructions);
helpBtn.addEventListener("click", openInstructions);
closeInstructionsBtn.addEventListener("click", closeInstructions);

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawShip(x, y, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  const size = 12;
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(-size, size);
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;

  const scaleX = canvas.width / dpr / WORLD_WIDTH;
  const scaleY = canvas.height / dpr / WORLD_HEIGHT;

  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  if (gameState) {
    for (const [x, y, rot] of gameState.players) {
      drawShip(x, y, rot);
    }

    ctx.strokeStyle = "gray";
    for (const [x, y, r] of gameState.asteroids) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "white";
    for (const [x, y] of gameState.shots) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  requestAnimationFrame(render);
}

connect();
render();
