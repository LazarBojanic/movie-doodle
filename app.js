import * as THREE from "three";

const API_KEY = "eaca5351";

const container = document.getElementById("canvasContainer");
const movieTitleEl = document.getElementById("movieTitle");
const dialog = document.getElementById("dialog");
const movieInput = document.getElementById("movieInput");
const okBtn = document.getElementById("okBtn");
const cancelBtn = document.getElementById("cancelBtn");

const brushBtn = document.getElementById("brushBtn");
const eraserBtn = document.getElementById("eraserBtn");
const posterBtn = document.getElementById("posterBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const idBtn = document.getElementById("idBtn");

/* ===== Three.js setup ===== */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.OrthographicCamera(-250, 250, 350, -350, 1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(500, 700);
renderer.domElement.style.borderRadius = "12px";
container.appendChild(renderer.domElement);

/* ===== Poster Plane ===== */
let posterVisible = false;
let posterTexture = null;
const posterMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
});
const posterMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 700),
  posterMaterial,
);
scene.add(posterMesh);
posterMesh.visible = false;

/* ===== Drawing Plane ===== */
const drawCanvas = document.createElement("canvas");
drawCanvas.width = 500;
drawCanvas.height = 700;
const drawCtx = drawCanvas.getContext("2d");
drawCtx.fillStyle = "white";
drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

const drawTexture = new THREE.CanvasTexture(drawCanvas);
const drawMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 700),
  new THREE.MeshBasicMaterial({ map: drawTexture }),
);
scene.add(drawMesh);

/* ===== Undo stack ===== */
let undoStack = [];
function saveState() {
  undoStack.push(
    drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height),
  );
  if (undoStack.length > 50) undoStack.shift();
}

/* ===== Render loop ===== */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

/* ===== Drawing ===== */
let isDrawing = false;
let currentTool = "brush"; // brush or eraser
renderer.domElement.addEventListener("pointerdown", (e) => {
  isDrawing = true;
  saveState();
  const rect = renderer.domElement.getBoundingClientRect();
  drawCtx.beginPath();
  drawCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!isDrawing) return;
  const rect = renderer.domElement.getBoundingClientRect();
  drawCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  drawCtx.strokeStyle = currentTool === "brush" ? "black" : "white";
  drawCtx.lineWidth = currentTool === "brush" ? 3 : 20;
  drawCtx.lineCap = "round";
  drawCtx.stroke();
  drawTexture.needsUpdate = true;
});
renderer.domElement.addEventListener("pointerup", () => (isDrawing = false));
renderer.domElement.addEventListener("pointerleave", () => (isDrawing = false));

/* ===== Tool buttons ===== */
function selectTool(tool) {
  currentTool = tool;
  if (tool === "brush") {
    brushBtn.classList.add("active");
    eraserBtn.classList.remove("active");
  } else {
    eraserBtn.classList.add("active");
    brushBtn.classList.remove("active");
  }
}

// Default brush selected
selectTool("brush");

brushBtn.addEventListener("click", () => selectTool("brush"));
eraserBtn.addEventListener("click", () => selectTool("eraser"));

/* ===== Other UI buttons ===== */
posterBtn.addEventListener("click", () => {
  if (!posterTexture) {
    alert("No poster loaded");
    return;
  }
  posterVisible = !posterVisible;
  posterMesh.visible = posterVisible;
});

undoBtn.addEventListener("click", () => {
  if (undoStack.length === 0) return;
  const img = undoStack.pop();
  drawCtx.putImageData(img, 0, 0);
  drawTexture.needsUpdate = true;
});

clearBtn.addEventListener("click", () => {
  saveState();
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.fillStyle = "white";
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawTexture.needsUpdate = true;
});

/* ===== ID dialog ===== */
idBtn.addEventListener("click", () => {
  dialog.style.display = "flex";
  movieInput.value = "";
  movieInput.focus();
});
cancelBtn.addEventListener("click", () => {
  dialog.style.display = "none";
});
okBtn.addEventListener("click", () => {
  dialog.style.display = "none";
  fetchMovieById(movieInput.value.trim());
});
movieInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") okBtn.click();
  if (e.key === "Escape") dialog.style.display = "none";
});

/* ===== OMDb fetch ===== */
function numericToImdb(n) {
  return "tt" + String(n).padStart(7, "0");
}

async function fetchMovieById(id) {
  const imdb = numericToImdb(id);
  movieTitleEl.textContent = "Loading…";
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?i=${imdb}&apikey=${API_KEY}`,
    );
    const data = await res.json();
    if (!data || data.Response === "False") {
      movieTitleEl.textContent = "";
      alert("Movie not found");
      return;
    }
    movieTitleEl.textContent = `${data.Title} (${data.Year || ""})`;
    if (!data.Poster || data.Poster === "N/A") {
      posterTexture = null;
      posterMesh.visible = false;
      posterVisible = false;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = data.Poster;
    img.onload = () => {
      posterTexture = new THREE.Texture(img);
      posterTexture.needsUpdate = true;
      posterMesh.material.map = posterTexture;
      posterMesh.visible = posterVisible;
    };
    img.onerror = () => {
      posterTexture = null;
      posterMesh.visible = false;
      posterVisible = false;
      alert("Failed to load poster");
    };
  } catch (e) {
    console.error(e);
    movieTitleEl.textContent = "";
    alert("Error fetching movie");
  }
}
