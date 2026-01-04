const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const modal = document.getElementById("gameOverModal");
const restartBtn = document.getElementById("restartBtn");

let gameState = null;

canvas.focus();

const WS = {
  socket: null,
  connected: false,
  reconnectTimer: null,
};

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

  if (msg.type === "state") {
    gameState = msg.data;

    if (msg.phase === "game_over") {
      modal.style.display = "block";
    } else {
      modal.style.display = "none";
    }
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

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState) {
    const [px, py] = gameState.player;

    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.stroke();

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
