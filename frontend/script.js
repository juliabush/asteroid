const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const modal = document.getElementById("gameOverModal");

const instructionsBtn = document.getElementById("instructionsBtn");
const instructionsModal = document.getElementById("instructionsModal");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

const menu = document.getElementById("menu");
const playBtn = document.getElementById("playBtn");

const nicknameInput = document.getElementById("nickname");

const homeBtn = document.getElementById("homeBtn");

const instructionsBox = document.querySelector(".instructions-box");

let gameState = null;
let playerId = null;
let thrusting = false;
let started = false;
let gameOverTimeout = null;

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
shipImage.src = "public/rocket.png";

const asteroidImages = [
  "public/blue.jpg",
  "public/creme.jpg",
  "public/moon.jpg",
  "public/orange.jpg",
  "public/pink.jpg",
  "public/saturn.jpeg",
].map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

const asteroidSkins = new Map();

const particles = [];

const music = new Audio("public/ObservingTheStar.ogg");
music.loop = true;
music.volume = 0.2;

const thrustSound = new Audio("public/rocket.wav");
thrustSound.loop = true;
thrustSound.volume = 0.2;

const shootSound = new Audio("public/shoot.wav");
shootSound.volume = 0.03;

let CAMERA_ZOOM = 1;

homeBtn.addEventListener("click", () => {
  if (gameOverTimeout) {
    clearTimeout(gameOverTimeout);
    gameOverTimeout = null;
  }

  modal.style.display = "none";
  canvas.style.display = "none";
  statusEl.style.display = "none";
  menu.style.display = "";
  instructionsBox.style.display = "";

  started = false;
  gameState = null;
  particles.length = 0;

  music.pause();
  music.currentTime = 0;
  send("restart");
});

function updateCameraZoom() {
  CAMERA_ZOOM = window.innerWidth < 1000 ? 2 : 1;
}

function spawnParticles(x, y, angle) {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x,
      y,
      vx: Math.cos(angle + Math.PI) * (1 + Math.random()),
      vy: Math.sin(angle + Math.PI) * (1 + Math.random()),
      life: 40 + Math.random() * 20,
      size: 2 + Math.random() * 2,
      alpha: 1,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= 1;
    p.alpha = p.life / 60;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    const t = 1 - p.alpha;

    let r;
    let g;
    let b;

    if (t < 0.5) {
      const k = t / 0.5;
      r = 20 + k * 120;
      g = 20 + k * 120;
      b = 20 + k * 120;
    } else {
      const k = (t - 0.5) / 0.5;
      r = 140 + k * 115;
      g = 140 + k * 115;
      b = 140 + k * 115;
    }

    ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function send(type, payload = {}) {
  if (!WS.socket || WS.socket.readyState !== WebSocket.OPEN) return;
  WS.socket.send(JSON.stringify({ type, ...payload }));
}

function connect() {
  if (WS.socket && WS.socket.readyState === WebSocket.OPEN) return;

  WS.socket = new WebSocket("wss://juliabush.pl/ws");

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
    if (!started) return;

    const isGameOver = msg.phase === "game_over";

    if (!isGameOver && gameOverTimeout) {
      clearTimeout(gameOverTimeout);
      gameOverTimeout = null;
    }

    gameState = msg.data;

    if (modal) modal.style.display = isGameOver ? "block" : "none";
    if (helpBtn) helpBtn.style.display = isGameOver ? "none" : "block";

    if (isGameOver) {
      music.pause();
      music.currentTime = 0;
    }

    if (isGameOver && !gameOverTimeout) {
      music.pause();
      music.currentTime = 0;
      thrustSound.pause();
      thrustSound.currentTime = 0;

      started = false;

      if (modal) modal.style.display = "block";
      if (helpBtn) helpBtn.style.display = "none";

      gameOverTimeout = setTimeout(() => {
        if (modal) modal.style.display = "none";
        canvas.style.display = "none";
        statusEl.style.display = "none";
        menu.style.display = "";

        particles.length = 0;
        gameState = null;

        send("restart");
        gameOverTimeout = null;
      }, 2000);
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (e.target === nicknameInput) return;

  if (e.key === " ") {
    shootSound.currentTime = 0;
    shootSound.play().catch(() => {});
  }

  e.preventDefault();
  if (e.key === "ArrowUp" || e.key === "w") {
    thrusting = true;
    if (thrustSound.paused) {
      thrustSound.play().catch(() => {});
    }
  }
  send("input", { key: e.key });
});

window.addEventListener("keyup", (e) => {
  if (e.target === nicknameInput) return;

  e.preventDefault();
  if (e.key === "ArrowUp" || e.key === "w") {
    thrusting = false;
    thrustSound.pause();
    thrustSound.currentTime = 0;
  }
  send("input_release", { key: e.key });
});

function drawShip(x, y, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  if (thrusting) {
    const flicker = Math.random() * 5;

    const angle = (rotation * Math.PI) / 180 - Math.PI / 4 - 0.7;

    const flameOffset = 12;

    spawnParticles(
      x - Math.cos(angle) * flameOffset,
      y - Math.sin(angle) * flameOffset,
      angle,
    );

    ctx.save();
    ctx.rotate(Math.PI);
    ctx.translate(0, 10);
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
function drawWorldBounds() {
  ctx.save();

  ctx.strokeStyle = "rgba(20, 40, 90, 0.6)";
  ctx.lineWidth = 8 / CAMERA_ZOOM;

  ctx.shadowColor = "rgba(20, 40, 120, 0.8)";
  ctx.shadowBlur = 40 / CAMERA_ZOOM;

  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;

  const scale =
    Math.min(
      canvas.width / dpr / WORLD_WIDTH,
      canvas.height / dpr / WORLD_HEIGHT,
    ) * CAMERA_ZOOM;

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
    scale,
    0,
    0,
    scale,
    canvas.width / (2 * dpr) - camX * scale,
    canvas.height / (2 * dpr) - camY * scale,
  );

  ctx.clearRect(
    camX - WORLD_WIDTH,
    camY - WORLD_HEIGHT,
    WORLD_WIDTH * 2,
    WORLD_HEIGHT * 2,
  );

  drawWorldBounds();

  updateParticles();
  drawParticles();

  if (gameState) {
    for (const [, x, y, rot, nickname] of gameState.players) {
      drawShip(x, y, rot);

      if (nickname) {
        ctx.save();
        ctx.fillStyle = "white";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(nickname, x, y - 35);
        ctx.restore();
      }
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

function resizeCanvas() {
  updateCameraZoom();

  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
}

window.addEventListener("resize", resizeCanvas);

playBtn.addEventListener("click", () => {
  if (started) return;
  started = true;

  if (gameOverTimeout) {
    clearTimeout(gameOverTimeout);
    gameOverTimeout = null;
  }

  music.currentTime = 0;
  music.play().catch(() => {});

  const nickname = nicknameInput.value.trim();

  menu.style.display = "none";
  instructionsBox.style.display = "none";
  canvas.style.display = "block";
  statusEl.style.display = "block";

  resizeCanvas();
  connect();

  if (WS.socket.readyState === WebSocket.OPEN) {
    send("set_nickname", { nickname });
  } else {
    WS.socket.addEventListener("open", () => {
      send("set_nickname", { nickname });
    });
  }

  updateCameraZoom();
  render();
});
