import * as THREE from "three";

const API_KEY = "eaca5351";

const container = document.getElementById("canvasContainer");
const movieTitleEl = document.getElementById("movieTitle");
const dialog = document.getElementById("dialog");
const movieInput = document.getElementById("movieInput");
const okBtn = document.getElementById("okBtn");
const cancelBtn = document.getElementById("cancelBtn");
const idBtn = document.getElementById("idBtn");
const posterBtn = document.getElementById("posterBtn");
const clearBtn = document.getElementById("clearBtn");

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

/* ===== Render loop ===== */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

/* ===== Drawing ===== */
let isDrawing = false;
renderer.domElement.addEventListener("pointerdown", (e) => {
  isDrawing = true;
  const rect = renderer.domElement.getBoundingClientRect();
  drawCtx.beginPath();
  drawCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!isDrawing) return;
  const rect = renderer.domElement.getBoundingClientRect();
  drawCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  drawCtx.strokeStyle = "black";
  drawCtx.lineWidth = 3;
  drawCtx.lineCap = "round";
  drawCtx.stroke();
  drawTexture.needsUpdate = true;
});
renderer.domElement.addEventListener("pointerup", () => (isDrawing = false));
renderer.domElement.addEventListener("pointerleave", () => (isDrawing = false));

/* ===== UI Handlers ===== */
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

posterBtn.addEventListener("click", () => {
  if (!posterTexture) {
    alert("No poster loaded");
    return;
  }
  posterVisible = !posterVisible;
  posterMesh.visible = posterVisible;
});

clearBtn.addEventListener("click", () => {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.fillStyle = "white";
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawTexture.needsUpdate = true;
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
