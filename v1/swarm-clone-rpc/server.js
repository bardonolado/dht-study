import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("eeda984d9429d42a4d8a492d41").digest();

const main = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();

    const hdhtKeyPair = HyperDHT.keyPair();

    for await (const event of hdht.announce(TOPIC, hdhtKeyPair)) {
        // console.log("Announced event", event);
    }

    console.log("HDHT is ready and announced");
    
    const hrpc = new HyperRPC({keyPair: hdhtKeyPair, dht: hdht});
    const hrpcServer = hrpc.createServer();
    await hrpcServer.listen();
    
    hrpcServer.respond("clone", {}, async (req) => {
        console.log("clone");
        return Buffer.from(JSON.stringify({ok: true}));
    });

    console.log("RPC server is listening");
}

main();