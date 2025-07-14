// lookup.js
import DHT from '@hyperswarm/dht'
import crypto from 'crypto'

const dht = new DHT({})
await dht.ready();

const keypair = DHT.keyPair()
const topic = crypto.createHash("sha256").update("cool-funcs-topic-1188498").digest()


const lookup = dht.lookup(topic, keypair);

for await (const peer of lookup ) {
  console.log('Found peer:', peer.from)

  const socket = dht.connect(peer.from, keypair)
  socket.on('data', d => console.log('Got:', d.toString()))
  socket.write('Hi from B!')
  break
}
