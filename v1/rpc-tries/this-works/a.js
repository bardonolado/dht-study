// announcer.js
import DHT from '@hyperswarm/dht'
import crypto from 'crypto'

const dht = new DHT({ })
await dht.ready();
const keypair = DHT.keyPair();
const topic = crypto.createHash("sha256").update("cool-funcs-topic-1188498").digest()

for await (const event of dht.announce(topic, keypair)) {
    console.log("Announced event", event);
}


const server = dht.createServer(socket => {
  console.log('Incoming connection')
  socket.on('data', d => console.log('Got:', d.toString()))
  socket.write('Hi from A!')
})

await server.listen(keypair)
console.log('Listening...')
