const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const size = 20;

const colorPalette = [
    "#1E3A8A", // Deep Blue
    "#065F46", // Dark Green
    "#0F766E", // Teal
    "#7C3AED", // Purple
    "#BE185D", // Dark Pink
    "#DC2626", // Red
    "#EA580C", // Orange
    "#D97706", // Amber
    "#15803D", // Green
    "#0369A1", // Sky Blue
    "#7C2D12", // Brown
    "#374151"  // Gray
];

let selectedColor = colorPalette[0];

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

canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / size);
    const y = Math.floor((e.clientY - rect.top) / size);
    
    drawPixel(x, y, selectedColor);

    fetch("/pixel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y, color: selectedColor })
    });
});

// Initialize color palette
createColorPalette();

// Load pixels initially
loadPixels();

// Refresh pixels every 1 second
setInterval(() => {
    loadPixels();
}, 1000);
