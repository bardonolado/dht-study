import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("cool-funcs-topic-1188498").digest();

const main = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();

    const keyPair = HyperDHT.keyPair();

    const result = await hdht.announce(TOPIC, keyPair);
    console.log(result);

    for await (const peer of hdht.lookup(TOPIC)) {
        console.log('Found peer:', peer)

        // Peer is { from: NodeInfo }
        const socket = hdht.connect(peer.from, keyPair)

        socket.on('data', data => {
            console.log('Got:', data.toString())
        })

        socket.write('Hello from lookup!')
    }
}

main();