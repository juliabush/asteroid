const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const modal = document.getElementById("gameOverModal");
const restartBtn = document.getElementById("restartBtn");

const instructionsBtn = document.getElementById("instructionsBtn");
const instructionsModal = document.getElementById("instructionsModal");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

const helpBtn = document.getElementById("helpBtn");
helpBtn.style.display = "block";

let gameState = null;

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

function sendViewportSize() {
  const dpr = window.devicePixelRatio || 1;
  send("resize", {
    width: canvas.width / dpr,
    height: canvas.height / dpr,
  });
}

function connect() {
  if (WS.socket && WS.socket.readyState === WebSocket.OPEN) return;

  WS.socket = new WebSocket("wss://juliabush.pl/ws");

  WS.socket.onopen = () => {
    WS.connected = true;
    statusEl.textContent = "Connected";
    clearTimeout(WS.reconnectTimer);
    sendViewportSize();
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

  if (modal.style.display === "block") {
    if (e.key === "Enter") {
      modal.style.display = "none";
      send("restart");
    }
    return;
  }

  send("input", { key: e.key });
});

window.addEventListener("keyup", (e) => {
  e.preventDefault();
  if (modal.style.display === "block") return;
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

instructionsBtn.addEventListener("click", openInstructions);
helpBtn.addEventListener("click", openInstructions);
closeInstructionsBtn.addEventListener("click", closeInstructions);

restartBtn.addEventListener("click", () => {
  modal.style.display = "none";
  send("restart");
});

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  sendViewportSize();
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
