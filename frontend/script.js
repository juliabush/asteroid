const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const socket = new WebSocket("ws://localhost:8000");

socket.onopen = () => {
  console.log("Connected to server");
  statusEl.textContent = "Connected";
};

socket.onclose = () => {
  console.log("Disconnected");
  statusEl.textContent = "Disconnected";
};

socket.onerror = (err) => {
  console.error("WebSocket error:", err);
  statusEl.textContent = "Connection error";
};

let gameState = null;

window.addEventListener("keydown", (e) => {
  socket.send(JSON.stringify({ type: "input", key: e.key }));
});
window.addEventListener("keyup", (e) => {
  socket.send(JSON.stringify({ type: "input_release", key: e.key }));
});

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "state") {
    gameState = msg.data;
  }
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";

  if (!gameState) {
    ctx.fillText("Waiting for game state...", 20, 40);
    requestAnimationFrame(draw);
    return;
  }

  const [px, py] = gameState.player;
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  ctx.strokeStyle = "gray";
  for (const [ax, ay, ar] of gameState.asteroids) {
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "red";
  for (const [sx, sy] of gameState.shots) {
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

draw();

const modal = document.getElementById("gameOverModal");
const restartBtn = document.getElementById("restartBtn");

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "state") {
    gameState = msg.data;
  } else if (msg.type === "game_over") {
    modal.style.display = "flex";
    gameState = null;
  }
};

restartBtn.addEventListener("click", () => {
  socket.send(JSON.stringify({ type: "restart" }));
  modal.style.display = "none";
});
