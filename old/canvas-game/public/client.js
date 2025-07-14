const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

const size = 10 // pixel size

async function loadPixels() {
  const res = await fetch('/pixels')
  const pixels = await res.json()
  pixels.forEach(({ x, y, color }) => {
    drawPixel(x, y, color)
  })
}

function drawPixel(x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x * size, y * size, size, size)
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) / size)
  const y = Math.floor((e.clientY - rect.top) / size)
  const color = '#'+Math.floor(Math.random()*16777215).toString(16)

  drawPixel(x, y, color)

  fetch('/pixel', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ x, y, color })
  })
})

loadPixels()
