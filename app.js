import * as THREE from "three";
import BrushIcon from "@material-symbols/svg-400/outlined/brush.svg";
import InkEraserIcon from "@material-symbols/svg-400/outlined/ink_eraser.svg";
import UndoIcon from "@material-symbols/svg-400/outlined/undo.svg";
import DeleteIcon from "@material-symbols/svg-400/outlined/delete.svg";
import FillIcon from "@material-symbols/svg-400/outlined/format_color_fill.svg";
import PaletteIcon from "@material-symbols/svg-400/outlined/palette.svg";

/* --- Replace with your TMDb key --- */
const TMDB_API_KEY = "923ba34a720eb4f615326820215f419d";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

/* UI elements */
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

const toolbarButtons = [brushBtn, eraserBtn, posterBtn, undoBtn, clearBtn, idBtn, okBtn, cancelBtn];
toolbarButtons.forEach(btn => {
  btn.addEventListener("pointerdown", e => e.stopPropagation());
  btn.addEventListener("pointerup", e => e.stopPropagation());
  btn.addEventListener("click", e => e.stopPropagation());
  btn.addEventListener("touchstart", e => e.stopPropagation(), { passive: false });
  btn.addEventListener("touchend", e => e.stopPropagation(), { passive: false });
});

/* Inject SVG icons */
brushBtn.innerHTML = `<img src="${BrushIcon}" alt="Brush">`;
eraserBtn.innerHTML = `<img src="${InkEraserIcon}" alt="Eraser">`;
undoBtn.innerHTML = `<img src="${UndoIcon}" alt="Undo">`;
clearBtn.innerHTML = `<img src="${DeleteIcon}" alt="Clear">`;
posterBtn.innerHTML = `<img src="${FillIcon}" alt="Fill">`;
idBtn.innerHTML = `<img src="${PaletteIcon}" alt="Palette">`;

/* --- Three.js setup --- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.style.borderRadius = "12px";
container.appendChild(renderer.domElement);

/* Poster & background planes */
const posterMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
let posterTexture = null;
let posterMesh = null;

let backgroundMesh = null;

/* Draw canvas */
let drawCanvas = null;
let drawCtx = null;
let drawTexture = null;

/* Undo stack */
let undoStack = [];

/* Tool state */
let currentTool = "brush";
let isDrawing = false;
let DPR = Math.max(1, window.devicePixelRatio || 1);

/* --- Utilities --- */
function getCssSize() {
  const rect = container.getBoundingClientRect();
  return { cssWidth: Math.max(1, Math.round(rect.width)), cssHeight: Math.max(1, Math.round(rect.height)) };
}

function computeBrushDeviceSizes(cssW, cssH) {
  const minSide = Math.min(cssW, cssH);
  const brushCss = Math.max(1.5, Math.round(minSide / 200));
  const eraserCss = Math.max(8, Math.round(brushCss * 6));
  return { brushCss, eraserCss, brushDev: Math.round(brushCss * DPR), eraserDev: Math.round(eraserCss * DPR) };
}

/* --- Resize and setup --- */
function resizeAll() {
  const { cssWidth, cssHeight } = getCssSize();
  DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  renderer.setPixelRatio(DPR);
  renderer.setSize(cssWidth, cssHeight, false);

  camera.left = -cssWidth / 2;
  camera.right = cssWidth / 2;
  camera.top = cssHeight / 2;
  camera.bottom = -cssHeight / 2;
  camera.updateProjectionMatrix();

  // Background plane
  if (!backgroundMesh) {
    const geo = new THREE.PlaneGeometry(cssWidth, cssHeight);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    backgroundMesh = new THREE.Mesh(geo, mat);
    backgroundMesh.position.set(0, 0, -2);
    scene.add(backgroundMesh);
  } else {
    backgroundMesh.geometry.dispose();
    backgroundMesh.geometry = new THREE.PlaneGeometry(cssWidth, cssHeight);
  }

  // Poster plane
  if (!posterMesh) {
    posterMesh = new THREE.Mesh(new THREE.PlaneGeometry(cssWidth, cssHeight), posterMaterial);
    posterMesh.position.set(0, 0, -1);
    posterMesh.visible = false;
    scene.add(posterMesh);
  }

  // Draw canvas
  const devW = cssWidth * DPR;
  const devH = cssHeight * DPR;
  let old = null;
  if (drawCanvas) {
    old = document.createElement("canvas");
    old.width = drawCanvas.width;
    old.height = drawCanvas.height;
    old.getContext("2d").drawImage(drawCanvas, 0, 0);
  }

  drawCanvas = document.createElement("canvas");
  drawCanvas.width = devW;
  drawCanvas.height = devH;
  drawCanvas.style.width = cssWidth + "px";
  drawCanvas.style.height = cssHeight + "px";
  drawCtx = drawCanvas.getContext("2d", { alpha: true });

  if (old) drawCtx.drawImage(old, 0, 0, old.width, old.height, 0, 0, devW, devH);
  else drawCtx.clearRect(0, 0, devW, devH);

  if (!drawTexture) drawTexture = new THREE.CanvasTexture(drawCanvas);
  else { drawTexture.image = drawCanvas; drawTexture.needsUpdate = true; }

  if (!scene.getObjectByName("drawMesh")) {
    const drawMat = new THREE.MeshBasicMaterial({ map: drawTexture, transparent: true });
    const drawGeo = new THREE.PlaneGeometry(cssWidth, cssHeight);
    const drawMesh = new THREE.Mesh(drawGeo, drawMat);
    drawMesh.name = "drawMesh";
    drawMesh.position.set(0, 0, 0);
    scene.add(drawMesh);
  } else {
    const dm = scene.getObjectByName("drawMesh");
    dm.geometry.dispose();
    dm.geometry = new THREE.PlaneGeometry(cssWidth, cssHeight);
    dm.material.map = drawTexture;
    dm.material.transparent = true;
  }

  drawTexture.needsUpdate = true;

  // Resize poster plane if already loaded
  if (posterTexture) setPosterTexture(posterTexture.image);
}

/* --- Initial sizing and resize handlers --- */
resizeAll();
window.addEventListener("resize", () => setTimeout(resizeAll, 120));
window.addEventListener("orientationchange", () => setTimeout(resizeAll, 200));

/* --- Render loop --- */
function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
animate();

/* --- Pointer helpers --- */
function clientToDevice(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const devX = Math.round(cssX * (drawCanvas.width / rect.width));
  const devY = Math.round(cssY * (drawCanvas.height / rect.height));
  return [devX, devY];
}

function getLineWidths() {
  const { width: cssW, height: cssH } = renderer.domElement.getBoundingClientRect();
  return computeBrushDeviceSizes(cssW, cssH);
}

function pushUndo() {
  try {
    const data = drawCtx.getImageData(0,0,drawCanvas.width,drawCanvas.height);
    undoStack.push(data);
    if (undoStack.length>60) undoStack.shift();
  } catch(e){ console.warn("pushUndo failed", e); }
}

/* --- Drawing --- */
function beginStroke(e) {
  if(e.cancelable) e.preventDefault();
  pushUndo();
  isDrawing = true;
  const [devX, devY] = clientToDevice(e);
  const widths = getLineWidths();
  drawCtx.beginPath();
  drawCtx.lineWidth = (currentTool==="brush") ? widths.brushDev : widths.eraserDev;
  drawCtx.lineCap = "round";
  if (currentTool==="eraser") {
    drawCtx.globalCompositeOperation="destination-out"; drawCtx.strokeStyle="rgba(0,0,0,1)";
  } else {
    drawCtx.globalCompositeOperation="source-over"; drawCtx.strokeStyle="black";
  }
  drawCtx.moveTo(devX, devY);
  drawTexture.needsUpdate = true;
}
function moveStroke(e) { if(!isDrawing) return; if(e.cancelable)e.preventDefault(); const [devX, devY]=clientToDevice(e); drawCtx.lineTo(devX, devY); drawCtx.stroke(); drawTexture.needsUpdate=true; }
function endStroke(e) { if(e && e.cancelable) e.preventDefault(); isDrawing=false; drawCtx.globalCompositeOperation="source-over"; }

/* --- Attach pointer/touch --- */
renderer.domElement.style.touchAction="none";
renderer.domElement.addEventListener("pointerdown", beginStroke, {passive:false});
renderer.domElement.addEventListener("pointermove", moveStroke, {passive:false});
window.addEventListener("pointerup", endStroke, {passive:false});
window.addEventListener("pointercancel", endStroke, {passive:false});
renderer.domElement.addEventListener("touchstart", e=>{ e.preventDefault(); beginStroke(e); }, {passive:false});
renderer.domElement.addEventListener("touchmove", e=>{ e.preventDefault(); moveStroke(e); }, {passive:false});
window.addEventListener("touchend", e=>{ e.preventDefault(); endStroke(e); }, {passive:false});

/* --- Tool selection --- */
function selectTool(tool) {
  currentTool=tool;
  brushBtn.classList.toggle("active", tool==="brush");
  eraserBtn.classList.toggle("active", tool==="eraser");
}
selectTool("brush");
brushBtn.addEventListener("click", ()=>selectTool("brush"));
eraserBtn.addEventListener("click", ()=>selectTool("eraser"));

/* --- Undo/Clear --- */
undoBtn.addEventListener("click", ()=>{
  if(!undoStack.length) return;
  drawCtx.putImageData(undoStack.pop(),0,0);
  drawTexture.needsUpdate=true;
});
clearBtn.addEventListener("click", ()=>{
  pushUndo(); drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height); drawTexture.needsUpdate=true;
});

/* --- Poster toggle --- */
posterBtn.addEventListener("click", ()=>{
  if(!posterTexture) return alert("No poster loaded");
  posterMesh.visible = !posterMesh.visible;
});

/* --- ID dialog --- */
idBtn.addEventListener("click", ()=>{ dialog.style.display="flex"; movieInput.value=""; movieInput.focus(); });
cancelBtn.addEventListener("click", ()=>{ dialog.style.display="none"; });
okBtn.addEventListener("click", ()=>{ dialog.style.display="none"; fetchMovieById(movieInput.value.trim()); });
movieInput.addEventListener("keydown", e=>{ if(e.key==="Enter") okBtn.click(); if(e.key==="Escape") dialog.style.display="none"; });

/* --- Poster scaling helper --- */
function setPosterTexture(img) {
  if (!posterTexture) posterTexture = new THREE.Texture(img);
  else posterTexture.image = img;
  posterTexture.needsUpdate = true;

  const { cssWidth, cssHeight } = getCssSize();
  const canvasAspect = cssWidth / cssHeight;
  const imgAspect = img.width / img.height;

  let planeW, planeH;

  if (imgAspect > canvasAspect) {
    // Image wider than canvas
    planeW = cssWidth;
    planeH = cssWidth / imgAspect;
  } else {
    // Image taller than canvas
    planeH = cssHeight;
    planeW = cssHeight * imgAspect;
  }

  // Centered mesh
  if (!posterMesh) {
    posterMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), posterMaterial);
    posterMesh.position.set(0, 0, -1);
    scene.add(posterMesh);
  } else {
    posterMesh.geometry.dispose();
    posterMesh.geometry = new THREE.PlaneGeometry(planeW, planeH);
  }

  posterMesh.material.map = posterTexture;
  posterMesh.material.needsUpdate = true;
  posterMesh.visible = true;
}


/* --- TMDb fetch --- */
async function fetchMovieById(id){
  if(!id) return;
  movieTitleEl.textContent="Loading…";
  try{
    const res = await fetch(`https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=en-US`);
    const data = await res.json();
    if(!data || data.success===false){ movieTitleEl.textContent=""; posterTexture=null; if(posterMesh) posterMesh.visible=false; return alert("Movie not found"); }
    movieTitleEl.textContent=`${data.title} (${(data.release_date||"").slice(0,4)})`;
    if(!data.poster_path){ posterTexture=null; if(posterMesh) posterMesh.visible=false; return; }
    const img = new Image();
    img.crossOrigin="anonymous";
    img.src = TMDB_IMAGE_BASE+data.poster_path;
    img.onload=()=>setPosterTexture(img);
    img.onerror=()=>{ posterTexture=null; if(posterMesh) posterMesh.visible=false; alert("Failed to load poster"); };
  } catch(err){ console.error(err); movieTitleEl.textContent=""; alert("Error fetching movie"); }
}

/* --- Expose for debugging --- */
window.__movieSketch={ renderer, scene, camera, drawCanvas, drawCtx, drawTexture, posterMesh };
