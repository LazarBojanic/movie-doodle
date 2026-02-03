import BrushIcon from "@material-symbols/svg-400/outlined/brush.svg";
import InkEraserIcon from "@material-symbols/svg-400/outlined/ink_eraser.svg";
import UndoIcon from "@material-symbols/svg-400/outlined/undo.svg";
import DeleteIcon from "@material-symbols/svg-400/outlined/delete.svg";
import FillIcon from "@material-symbols/svg-400/outlined/format_color_fill.svg";
import PaletteIcon from "@material-symbols/svg-400/outlined/palette.svg";

/* --- TMDb key --- */
const TMDB_API_KEY = "923ba34a720eb4f615326820215f419d";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

/* --- UI elements --- */
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
    btn.addEventListener("touchstart", e => e.stopPropagation(), {passive: false});
    btn.addEventListener("touchend", e => e.stopPropagation(), {passive: false});
});

/* --- Inject SVG icons --- */
brushBtn.innerHTML = `<img src="${BrushIcon}" alt="Brush">`;
eraserBtn.innerHTML = `<img src="${InkEraserIcon}" alt="Eraser">`;
undoBtn.innerHTML = `<img src="${UndoIcon}" alt="Undo">`;
clearBtn.innerHTML = `<img src="${DeleteIcon}" alt="Clear">`;
posterBtn.innerHTML = `<img src="${FillIcon}" alt="Fill">`;
idBtn.innerHTML = `<img src="${PaletteIcon}" alt="Palette">`;

/* --- Canvas setup --- */
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.borderRadius = "12px";
container.appendChild(canvas);

/* --- State --- */
let DPR = Math.max(1, window.devicePixelRatio || 1);
let drawCanvas = document.createElement("canvas");
let drawCtx = drawCanvas.getContext("2d");
let undoStack = [];
let currentTool = "brush";
let isDrawing = false;
let posterImage = null;
let showPoster = true;

/* --- Resize canvas --- */
function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * DPR;
    canvas.height = rect.height * DPR;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transforms
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCanvas.width = canvas.width;
    drawCanvas.height = canvas.height;

    redraw();
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 100));
resizeCanvas();

/* --- Brush sizes --- */
function computeBrushSizes() {
    const minSide = Math.min(canvas.width, canvas.height);
    const brush = Math.max(3, minSide / 150);
    const eraser = brush * 6;
    return {brush, eraser};
}

/* --- Undo --- */
function pushUndo() {
    try {
        undoStack.push(drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height));
        if (undoStack.length > 60) undoStack.shift();
    } catch (e) {
        console.warn("pushUndo failed", e);
    }
}

undoBtn.addEventListener("click", () => {
    if (!undoStack.length) return;
    drawCtx.putImageData(undoStack.pop(), 0, 0);
    redraw();
});

/* --- Clear --- */
clearBtn.addEventListener("click", () => {
    pushUndo();
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    redraw();
});

/* --- Tool selection --- */
function selectTool(tool) {
    currentTool = tool;
    brushBtn.classList.toggle("active", tool === "brush");
    eraserBtn.classList.toggle("active", tool === "eraser");
}

selectTool("brush");
brushBtn.addEventListener("click", () => selectTool("brush"));
eraserBtn.addEventListener("click", () => selectTool("eraser"));

/* --- Drawing --- */
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    return [(clientX - rect.left) * DPR, (clientY - rect.top) * DPR];
}

function beginStroke(e) {
    if (e.cancelable) e.preventDefault();
    pushUndo();
    isDrawing = true;
    const [x, y] = getPointerPos(e);
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
}

function moveStroke(e) {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const [x, y] = getPointerPos(e);
    const sizes = computeBrushSizes();
    drawCtx.lineWidth = (currentTool === "brush") ? sizes.brush : sizes.eraser;
    drawCtx.lineCap = "round";
    drawCtx.strokeStyle = (currentTool === "brush") ? "black" : "rgba(0,0,0,1)";
    drawCtx.globalCompositeOperation = (currentTool === "brush") ? "source-over" : "destination-out";
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
    redraw();
}

function endStroke(e) {
    if (e && e.cancelable) e.preventDefault();
    isDrawing = false;
    drawCtx.globalCompositeOperation = "source-over";
}

canvas.addEventListener("pointerdown", beginStroke, {passive: false});
canvas.addEventListener("pointermove", moveStroke, {passive: false});
window.addEventListener("pointerup", endStroke, {passive: false});
canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    beginStroke(e);
}, {passive: false});
canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    moveStroke(e);
}, {passive: false});
window.addEventListener("touchend", endStroke, {passive: false});

/* --- Poster toggle --- */
posterBtn.addEventListener("click", () => {
    showPoster = !showPoster;
    redraw();
});

/* --- Draw everything --- */
function redraw() {
    // Clear main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw poster if visible
    if (posterImage && showPoster) {
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const canvasAspect = canvasW / canvasH;
        const imgAspect = posterImage.width / posterImage.height;
        let drawW, drawH, offsetX = 0, offsetY = 0;
        if (imgAspect > canvasAspect) {
            drawW = canvasW;
            drawH = canvasW / imgAspect;
            offsetY = (canvasH - drawH) / 2;
        } else {
            drawH = canvasH;
            drawW = canvasH * imgAspect;
            offsetX = (canvasW - drawW) / 2;
        }
        // Save current context state
        ctx.save();
        // Set opacity (0.5 = 50% opacity, adjust as needed)
        ctx.globalAlpha = 0.5;
        ctx.drawImage(posterImage, offsetX, offsetY, drawW, drawH);
        // Restore context state (resets globalAlpha)
        ctx.restore();
    }

    // Draw user strokes
    ctx.drawImage(drawCanvas, 0, 0, canvas.width, canvas.height);
}

/* --- ID dialog --- */
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
movieInput.addEventListener("keydown", e => {
    if (e.key === "Enter") okBtn.click();
    if (e.key === "Escape") dialog.style.display = "none";
});

/* --- Fetch TMDb --- */
async function fetchMovieById(id) {
    if (!id) return;
    //movieTitleEl.textContent="Loading…";
    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=en-US`);
        const data = await res.json();
        if (!data || data.success === false) {
            movieTitleEl.textContent = "";
            posterImage = null;
            redraw();
            return alert("Movie not found");
        }
        //movieTitleEl.textContent=`${data.title} (${(data.release_date||"").slice(0,4)})`;
        if (!data.poster_path) {
            posterImage = null;
            redraw();
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = TMDB_IMAGE_BASE + data.poster_path;
        img.onload = () => {
            posterImage = img;
            redraw();
        };
        img.onerror = () => {
            posterImage = null;
            redraw();
            alert("Failed to load poster");
        };
    } catch (err) {
        console.error(err);
        movieTitleEl.textContent = "";
        alert("Error fetching movie");
    }
}

/* --- Expose for debugging --- */
window.__movieSketch = {canvas, ctx, drawCanvas, drawCtx};
