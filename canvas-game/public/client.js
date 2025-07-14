const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const size = 20;

const colorPalette = [
    "#FFFFFF", // White
    "#065F46", // Dark Green
    "#0F766E", // Teal
    "#7C3AED", // Purple
    "#BE185D", // Dark Pink
    "#DC2626", // Red
    "#EA580C", // Orange
    "#D97706", // Amber
    "#15803D", // Green
    "#1E3A8A", // Deep Blue
    "#7C2D12", // Brown
    "#374151"  // Gray
];

let selectedColor = colorPalette[0];
let isDrawing = false;

// Create color palette buttons
function createColorPalette() {
    const paletteContainer = document.getElementById("colorPalette");
    
    colorPalette.forEach((color, index) => {
        const colorButton = document.createElement("div");
        colorButton.className = "color-button";
        colorButton.style.backgroundColor = color;
        colorButton.dataset.color = color;
        
        if (index === 0) {
            colorButton.classList.add("selected");
        }
        
        colorButton.addEventListener("click", () => {
            document.querySelectorAll(".color-button").forEach(btn => {
                btn.classList.remove("selected");
            });
            
            colorButton.classList.add("selected");
            selectedColor = color;
        });
        
        paletteContainer.appendChild(colorButton);
    });
}

async function loadPixels() {
    const res = await fetch("/pixels");
    const pixels = await res.json();
    pixels.forEach(({ x, y, color }) => {
        drawPixel(x, y, color);
    });
}

function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);
}

function drawPixelAndSend(x, y) {
    drawPixel(x, y, selectedColor);
    
    fetch("/pixel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y, color: selectedColor })
    });
}

function getPixelCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / size);
    const y = Math.floor((e.clientY - rect.top) / size);
    return { x, y };
}

canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    const { x, y } = getPixelCoordinates(e);
    drawPixelAndSend(x, y);
});

canvas.addEventListener("mousemove", (e) => {
    if (isDrawing) {
        const { x, y } = getPixelCoordinates(e);
        drawPixelAndSend(x, y);
    }
});

canvas.addEventListener("mouseup", () => {
    isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
    isDrawing = false;
});

createColorPalette();

loadPixels();

setInterval(() => {
    loadPixels();
}, 1000);
