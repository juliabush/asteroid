const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const modal = document.getElementById("gameOverModal");

const instructionsBtn = document.getElementById("instructionsBtn");
const instructionsModal = document.getElementById("instructionsModal");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

const helpBtn = document.getElementById("helpBtn");
helpBtn.style.display = "block";

const menu = document.getElementById("menu");
const playBtn = document.getElementById("playBtn");

let gameState = null;
let playerId = null;
let thrusting = false;
let started = false;

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

const shipImage = new Image();
shipImage.src = "./public/rocket.png";

const asteroidImages = [
  "./public/blue.jpg",
  "./public/creme.jpg",
  "./public/moon.jpg",
  "./public/orange.jpg",
  "./public/pink.jpg",
  "./public/saturn.jpeg",
].map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

const asteroidSkins = new Map();

function send(type, payload = {}) {
  if (!WS.socket || WS.socket.readyState !== WebSocket.OPEN) return;
  WS.socket.send(JSON.stringify({ type, ...payload }));
}

function connect() {
  if (WS.socket && WS.socket.readyState === WebSocket.OPEN) return;

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

  if (msg.type === "init") {
    playerId = msg.playerId;
    return;
  }

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
  if (e.key === "ArrowUp" || e.key === "w") thrusting = true;
  send("input", { key: e.key });
});

window.addEventListener("keyup", (e) => {
  e.preventDefault();
  if (e.key === "ArrowUp" || e.key === "w") thrusting = false;
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
}

window.addEventListener("resize", resizeCanvas);

function drawWorldBounds() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();
}

function drawShip(x, y, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  if (thrusting) {
    const flicker = Math.random() * 5;

    ctx.save();
    ctx.rotate(Math.PI);

    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-9 - flicker, -52 - flicker);
    ctx.lineTo(9 + flicker, -52 - flicker);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-4, -42 - flicker);
    ctx.lineTo(4, -42 - flicker);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.rotate((-45 * Math.PI) / 180);

  const size = 45;
  ctx.drawImage(shipImage, -size / 2, -size / 2, size, size);

  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;

  const scaleX = canvas.width / dpr / WORLD_WIDTH;
  const scaleY = canvas.height / dpr / WORLD_HEIGHT;

  let camX = 0;
  let camY = 0;

  if (gameState && playerId !== null) {
    const me = gameState.players.find((p) => p[0] === playerId);
    if (me) {
      camX = me[1];
      camY = me[2];
    }
  }

  ctx.setTransform(
    scaleX,
    0,
    0,
    scaleY,
    canvas.width / (2 * dpr) - camX * scaleX,
    canvas.height / (2 * dpr) - camY * scaleY,
  );

  ctx.clearRect(
    camX - WORLD_WIDTH,
    camY - WORLD_HEIGHT,
    WORLD_WIDTH * 2,
    WORLD_HEIGHT * 2,
  );

  if (gameState) {
    drawWorldBounds();

    for (const [, x, y, rot] of gameState.players) {
      drawShip(x, y, rot);
    }

    for (const [id, x, y, r] of gameState.asteroids) {
      if (!asteroidSkins.has(id)) {
        const img =
          asteroidImages[Math.floor(Math.random() * asteroidImages.length)];
        asteroidSkins.set(id, img);
      }

      const img = asteroidSkins.get(id);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }

    ctx.fillStyle = "white";
    for (const [x, y] of gameState.shots) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  requestAnimationFrame(render);
}

playBtn.addEventListener("click", () => {
  if (started) return;
  started = true;

  menu.style.display = "none";
  canvas.style.display = "block";
  statusEl.style.display = "block";

  resizeCanvas();
  connect();
  render();
});
