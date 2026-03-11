const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

console.log("CLIENT START");

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
let rendering = false;
let initialized = false;

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
shipImage.onload = () => console.log("ship image loaded");
shipImage.onerror = () => console.error("ship image failed");
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
  img.onload = () => console.log("asteroid image loaded", src);
  img.onerror = () => console.error("asteroid image failed", src);
  img.src = src;
  return img;
});

const asteroidSkins = new Map();

const particles = [];

const music = new Audio("public/ObservingTheStar.ogg");
music.onplay = () => console.log("music playing");
music.onerror = () => console.error("music load error");

music.loop = true;
music.volume = 0.2;

const thrustSound = new Audio("public/rocket.wav");
thrustSound.onerror = () => console.error("rocket sound error");

thrustSound.loop = true;
thrustSound.volume = 0.2;

const shootSound = new Audio("public/shoot.wav");
shootSound.onerror = () => console.error("shoot sound error");

shootSound.volume = 0.03;

let CAMERA_ZOOM = 1;

homeBtn.addEventListener("click", () => {
  console.log("HOME CLICK");

  if (gameOverTimeout) {
    clearTimeout(gameOverTimeout);
    gameOverTimeout = null;
  }

  if (WS.socket) {
    console.log("closing websocket");
    WS.socket.close();
    WS.socket = null;
    WS.connected = false;
  }

  modal.style.display = "none";
  canvas.style.display = "none";
  menu.style.display = "";
  instructionsBox.style.display = "";

  started = false;
  initialized = false;
  playerId = null;
  gameState = null;
  particles.length = 0;

  music.pause();
  music.currentTime = 0;

  send("restart");
});

function updateCameraZoom() {
  CAMERA_ZOOM = window.innerWidth < 1000 ? 2 : 1;
}

function resetClientState() {
  gameState = null;
  playerId = null;
  thrusting = false;
  initialized = false;

  asteroidSkins.clear();
  particles.length = 0;

  if (modal) modal.style.display = "none";
  homeBtn.style.display = "none";
}

function send(type, payload = {}) {
  if (!WS.socket) {
    console.warn("send blocked: no socket", type);
    return;
  }

  if (WS.socket.readyState !== WebSocket.OPEN) {
    console.warn("send blocked: socket not open", type);
    return;
  }

  const msg = JSON.stringify({ type, ...payload });
  console.log("SEND", msg);
  WS.socket.send(msg);
}

function connect() {
  console.log("CONNECTING WS");

  if (
    WS.socket &&
    (WS.socket.readyState === WebSocket.OPEN ||
      WS.socket.readyState === WebSocket.CONNECTING)
  )
    return;

  WS.socket = new WebSocket("wss://juliabush.pl/ws");

  WS.socket.onopen = () => {
    console.log("WS OPEN");
    WS.connected = true;
    clearTimeout(WS.reconnectTimer);

    const nickname = nicknameInput.value.trim();
    send("set_nickname", { nickname });
  };

  WS.socket.onerror = (e) => {
    console.error("WS ERROR", e);
  };

  WS.socket.onclose = () => {
    console.warn("WS CLOSED");
    WS.connected = false;
    initialized = false;
    WS.reconnectTimer = setTimeout(connect, 2000);
  };

  WS.socket.onmessage = (e) => {
    console.log("WS MESSAGE", e.data);
    handleMessage({ data: e.data });
  };
}

function handleMessage(event) {
  let msg;

  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    console.error("message parse error", event.data);
    return;
  }

  if (msg.type === "init") {
    console.log("INIT RECEIVED", msg);
    playerId = msg.playerId;
    initialized = true;
    if (!rendering && started) render();
    return;
  }

  if (msg.world) {
    console.log("WORLD SIZE", msg.world);
    WORLD_WIDTH = msg.world[0];
    WORLD_HEIGHT = msg.world[1];
  }

  if (msg.type === "state") {
    console.log("STATE UPDATE", msg);

    if (!initialized) {
      console.warn("state ignored: not initialized");
      return;
    }

    gameState = msg.data;

    const isGameOver = msg.phase === "game_over";
    console.log("PHASE", msg.phase);

    if (!isGameOver && gameOverTimeout) {
      clearTimeout(gameOverTimeout);
      gameOverTimeout = null;
    }

    if (isGameOver) {
      const me = gameState.players.find((p) => p[0] === playerId);
      console.log("PLAYER LOOKUP", playerId, gameState.players);

      if (!started || !rendering) return;

      if (!me) {
        console.log("player not yet in state");
        return;
      }

      music.pause();
      music.currentTime = 0;
      thrustSound.pause();
      thrustSound.currentTime = 0;

      if (modal) modal.style.display = "block";
      homeBtn.style.display = "block";
      return;
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (e.target === nicknameInput) return;

  console.log("KEYDOWN", e.key);

  if (e.key === " " && !e.repeat) {
    shootSound.currentTime = 0;
    shootSound.play().catch(() => {});
  }

  if (e.key === "ArrowUp" || e.key === "w") {
    thrusting = true;
    thrustSound.play().catch(() => {});
  }

  send("input", { key: e.key });
});

window.addEventListener("keyup", (e) => {
  if (e.target === nicknameInput) return;

  console.log("KEYUP", e.key);

  if (e.key === "ArrowUp" || e.key === "w") {
    thrusting = false;
    thrustSound.pause();
    thrustSound.currentTime = 0;
  }

  send("input_release", { key: e.key });
});

function render() {
  if (!started) {
    rendering = false;
    return;
  }

  if (!initialized) {
    requestAnimationFrame(render);
    return;
  }

  rendering = true;

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

    if (!me) console.warn("player not found in state");

    if (me) {
      camX = me[1];
      camY = me[2];
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    canvas.width / (2 * dpr) - camX * scale,
    canvas.height / (2 * dpr) - camY * scale,
  );

  if (gameState) {
    for (const [, x, y, rot, nickname] of gameState.players) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(shipImage, -22, -20, 25, 25);
      ctx.restore();

      if (nickname) {
        ctx.save();
        ctx.font = "12px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(nickname, x, y - 35);
        ctx.restore();
      }
    }

    for (const [id, x, y, r] of gameState.asteroids) {
      if (!asteroidSkins.has(id)) {
        asteroidSkins.set(
          id,
          asteroidImages[Math.floor(Math.random() * asteroidImages.length)],
        );
      }

      const img = asteroidSkins.get(id);

      ctx.save();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);

      ctx.restore();
    }

    for (const [x, y] of gameState.shots) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  }

  requestAnimationFrame(render);
}

function resizeCanvas() {
  console.log("resize canvas");

  updateCameraZoom();

  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
}

window.addEventListener("resize", resizeCanvas);

playBtn.addEventListener("click", () => {
  console.log("PLAY CLICK");

  resetClientState();

  started = true;

  music.currentTime = 0;
  music.play().catch(() => console.warn("music blocked"));

  menu.style.display = "none";
  instructionsBox.style.display = "none";
  canvas.style.display = "block";

  resizeCanvas();
  connect();
  updateCameraZoom();

  if (!rendering) render();
});
