import * as THREE from "three";
import BrushIcon from "@material-symbols/svg-400/outlined/brush.svg";
import InkEraserIcon from "@material-symbols/svg-400/outlined/ink_eraser.svg";
import UndoIcon from "@material-symbols/svg-400/outlined/undo.svg";
import DeleteIcon from "@material-symbols/svg-400/outlined/delete.svg";
import FillIcon from "@material-symbols/svg-400/outlined/format_color_fill.svg";
import PaletteIcon from "@material-symbols/svg-400/outlined/palette.svg";

// Replace with your TMDb API key
const TMDB_API_KEY = "923ba34a720eb4f615326820215f419d";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

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

/* ===== Inject local SVG icons ===== */
brushBtn.innerHTML = `<img src="${BrushIcon}" alt="Brush">`;
eraserBtn.innerHTML = `<img src="${InkEraserIcon}" alt="Eraser">`;
undoBtn.innerHTML = `<img src="${UndoIcon}" alt="Undo">`;
clearBtn.innerHTML = `<img src="${DeleteIcon}" alt="Clear">`;
posterBtn.innerHTML = `<img src="${FillIcon}" alt="Poster">`;
idBtn.innerHTML = `<img src="${PaletteIcon}" alt="ID">`;

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

/* ===== Drawing logic ===== */
let isDrawing = false;
let currentTool = "brush"; // brush or eraser

function selectTool(tool) {
  currentTool = tool;
  brushBtn.classList.toggle("active", tool === "brush");
  eraserBtn.classList.toggle("active", tool === "eraser");
}
selectTool("brush"); // default

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

brushBtn.addEventListener("click", () => selectTool("brush"));
eraserBtn.addEventListener("click", () => selectTool("eraser"));

/* ===== Other UI buttons ===== */
posterBtn.addEventListener("click", () => {
  if (!posterTexture) return alert("No poster loaded");
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
cancelBtn.addEventListener("click", () => (dialog.style.display = "none"));
okBtn.addEventListener("click", () => {
  dialog.style.display = "none";
  fetchMovieById(movieInput.value.trim());
});
movieInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") okBtn.click();
  if (e.key === "Escape") dialog.style.display = "none";
});

/* ===== TMDb fetch ===== */
async function fetchMovieById(id) {
  movieTitleEl.textContent = "Loading…";

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`,
    );
    const data = await res.json();

    if (!data || data.success === false) {
      movieTitleEl.textContent = "";
      posterTexture = null;
      posterMesh.visible = false;
      posterVisible = false;
      return alert("Movie not found");
    }

    movieTitleEl.textContent = `${data.title} (${data.release_date?.slice(0, 4) || ""})`;

    if (!data.poster_path) {
      posterTexture = null;
      posterMesh.visible = false;
      posterVisible = false;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = TMDB_IMAGE_BASE + data.poster_path;

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
