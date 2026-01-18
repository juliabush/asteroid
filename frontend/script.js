const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const modal = document.getElementById("gameOverModal");
const restartBtn = document.getElementById("restartBtn");

const instructionsBtn = document.getElementById("instructionsBtn");
const instructionsModal = document.getElementById("instructionsModal");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

instructionsBtn.addEventListener("click", () => {
  instructionsModal.style.display = "block";
});

closeInstructionsBtn.addEventListener("click", () => {
  instructionsModal.style.display = "none";
});

let gameState = null;

canvas.focus();

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;

const WS = {
  socket: null,
  connected: false,
  reconnectTimer: null,
};

function connect() {
  if (WS.socket && WS.socket.readyState === WebSocket.OPEN) return;

  WS.socket = new WebSocket("wss://juliabush.pl");

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

  if (msg.type === "state") {
    gameState = msg.data;
    modal.style.display = msg.phase === "game_over" ? "block" : "none";
  }
}

function send(type, payload = {}) {
  if (!WS.socket || WS.socket.readyState !== WebSocket.OPEN) return;
  WS.socket.send(JSON.stringify({ type, ...payload }));
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

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function applyCameraTransform() {
  const dpr = window.devicePixelRatio || 1;

  const viewW = canvas.width / dpr;
  const viewH = canvas.height / dpr;

  const margin = 12;

  const scale = Math.min(
    viewW / (WORLD_WIDTH - margin * 2),
    viewH / (WORLD_HEIGHT - margin * 2),
  );

  const offsetX =
    (viewW - (WORLD_WIDTH - margin * 2) * scale) / 2 + margin * scale;
  const offsetY =
    (viewH - (WORLD_HEIGHT - margin * 2) * scale) / 2 + margin * scale;

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
}

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
    applyCameraTransform();

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
