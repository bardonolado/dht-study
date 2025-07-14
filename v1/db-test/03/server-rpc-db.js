import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "hyperdht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC_SEED = "cool-topic1188498";
const DHT_SEED = "8786780590d59eff60284104a08c432e516d7a699fa52a9752b2f916b4631a85";
const SWARM_SEED = "d0553361efcd25e1d81931d95b2020f29bde8bf77cd63bf7d9396cbae66e858b";
const RPC_SEED = "58f2d7d7995494f11cc246154fac40181ec494783ddd9cb4340b6a667607ecc4";

// console.log(crypto.randomBytes(32).toString("hex"));

const main = async () => {
    const dataPath = process.argv[2] || "./data";
    console.log(`Using Hypercore data path: ${dataPath}`);
    
    const hcore = new Hypercore(dataPath);
    await hcore.ready();

    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();

    // const dhtKeyPair = HyperDHT.keyPair(Buffer.from(DHT_SEED));
    const hdth = new HyperDHT();
    await hdth.ready();

    // const swarmKeyPair = HyperDHT.keyPair(Buffer.from(SWARM_SEED));
    const hswarm = new Hyperswarm({dht: hdth});

    // const rpcKeyPair = HyperDHT.keyPair(Buffer.from(RPC_SEED));
    const hrpc = new HyperRPC({dht: hdth});
    const hrpcServer = hrpc.createServer();
    await hrpcServer.listen();

    hrpcServer.respond("put", {}, async (req) => {
        const parsedData = JSON.parse(req);
        const key = parsedData.key;
        const value = parsedData.value;

        await hbee.put(key, value);
        return Buffer.from(JSON.stringify({ok: true}));
    });

    hrpcServer.respond("get", {}, async (req) => {
        const parsedData = JSON.parse(req);
        const key = parsedData.key;
        const value = parsedData.value;

        const result = await hbee.get(key);
        return Buffer.from(JSON.stringify({value: result ? result.value : null}));
    });

    hswarm.join(crypto.createHash("sha256").update(TOPIC_SEED).digest(), {
        server: true, client: true
    });

    hswarm.on("connection", async (socket, info, x) => {
        console.log("> New peer connected");
        console.log("info.client:", info.client);
        
        // Always replicate for bidirectional sync
        console.log("Replicating...");
        hcore.replicate(socket);
        
        // Send RPC key when acting as server
        if (!info.client) {
            socket.write(hrpc.defaultKeyPair.publicKey.toString("hex"));
        }
    });

    console.log("Hyperswarm server is running...");
    console.log("DHT Key:", hdth.defaultKeyPair.publicKey.toString("hex"));
    console.log("Swarm Key:", hswarm.keyPair.publicKey.toString("hex"));
    console.log("RPC Key:", hrpc.defaultKeyPair.publicKey.toString("hex"));

    // hdth.destroy();
    // hswarm.destroy();
    // hrpc.destroy();
}

main();