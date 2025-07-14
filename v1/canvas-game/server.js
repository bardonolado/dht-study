import DHT from '@hyperswarm/dht'
import NoiseSecretStream from '@hyperswarm/secret-stream'
import RPCProtocol from '@hyperswarm/rpc/protocol.js'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import crypto from 'crypto'
import express from 'express'

const dht = new DHT()
const keypair = DHT.keyPair()

// Create or open Hyperbee
const store = new Corestore('./storage')
await store.ready()
const feed = store.get({ name: 'canvas' })
await feed.ready()
const bee = new Hyperbee(feed, { keyEncoding: 'utf-8', valueEncoding: 'json' })

// Create RPC protocol
const protocol = RPCProtocol({ keyPair: keypair })

// RPC handler: drawPixel
protocol.respond('drawPixel', async (req) => {
  const { x, y, color } = JSON.parse(req.toString())
  await bee.put(`${x},${y}`, { color })
  console.log(`Pixel set: ${x},${y} -> ${color}`)
})

// DHT swarm join
const topic = crypto.createHash('sha256').update('my-p2p-pixel-canvas').digest()
dht.listen(keypair).on('connection', (socket) => handleConnection(socket, true))
dht.connect(topic).then(socket => handleConnection(socket, false))

// Secure & pipe Noise + RPC
function handleConnection(socket, isServer) {
  const noise = new NoiseSecretStream(isServer, keypair)
  noise.pipe(socket).pipe(noise)
  protocol.stream(noise)
}

// Simple HTTP server for the client
const app = express()
app.use(express.static('public'))
app.get('/pixels', async (req, res) => {
  const pixels = []
  for await (const { key, value } of bee.createReadStream()) {
    const [x, y] = key.split(',').map(Number)
    pixels.push({ x, y, color: value.color })
  }
  res.json(pixels)
})
app.post('/pixel', express.json(), async (req, res) => {
  const { x, y, color } = req.body
  await bee.put(`${x},${y}`, { color })

  // Broadcast to peers
  protocol.sessions.forEach(async (session) => {
    await session.request('drawPixel', Buffer.from(JSON.stringify({ x, y, color })))
  })

  res.sendStatus(200)
})

app.listen(3000, () => console.log('Web server on http://localhost:3000'))
