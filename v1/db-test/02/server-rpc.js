import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "hyperdht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC_SEED = "cool-topic1188495";
const DHT_SEED = "8786780590d59eff60284104a08c432e516d7a699fa52a9752b2f916b4631a85";
const SWARM_SEED = "d0553361efcd25e1d81931d95b2020f29bde8bf77cd63bf7d9396cbae66e858b";
const RPC_SEED = "58f2d7d7995494f11cc246154fac40181ec494783ddd9cb4340b6a667607ecc4";

// console.log(crypto.randomBytes(32).toString("hex"));

const main = async () => {
    const dhtKeyPair = HyperDHT.keyPair(Buffer.from(DHT_SEED));
    const hdth = new HyperDHT({keyPair: dhtKeyPair});
    await hdth.ready();

    // const swarmKeyPair = HyperDHT.keyPair(Buffer.from(SWARM_SEED));
    const hswarm = new Hyperswarm({dht: hdth});

    // const rpcKeyPair = HyperDHT.keyPair(Buffer.from(RPC_SEED));
    const hrpc = new HyperRPC({dht: hdth});
    const hrpcServer = hrpc.createServer();
    await hrpcServer.listen();

    hrpcServer.respond("put", {}, async (req) => {
        console.log("PUT");
        return Buffer.from(JSON.stringify({ok: true}));
    });

    hrpcServer.respond("get", {}, async (req) => {
        console.log("GET");
        return Buffer.from(JSON.stringify({ok: true}));
    });

    hswarm.join(crypto.createHash("sha256").update(TOPIC_SEED).digest(), {
        lookup: true, announce: true,
        server: true, client: false, local: true
    });

    hswarm.on("connection", async (socket) => {
        console.log("> New peer connected");
        socket.write(hrpc.defaultKeyPair.publicKey.toString("hex"));
    });

    console.log("Hyperswarm server is running...");
    console.log("DHT Key:", hdth.defaultKeyPair.publicKey.toString("hex"));
    console.log("Swarm Key:", hswarm.keyPair.publicKey.toString("hex"));
    console.log("RPC Key:", hrpc.defaultKeyPair.publicKey.toString("hex"));

    // hdth.destroy();
    // hswarm.destroy();
    // hrpc.destroy();
}

const mainx = async () => {
    const dataPath = process.argv[2] || "./data";
    console.log(`! Using Hypercore data path: ${dataPath}`);

    // STORAGE STUFF
    // const hcore = new Hypercore(dataPath);
    // await hcore.ready();
    // console.log("! Hypercore is ready.");
    // console.log("! Hypercore key:", hcore.key.toString("hex"));
    
    // const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    // await hbee.ready();
    // console.log("! Hyperbee is ready.");
    
    const hswarm = new Hyperswarm();

    const topic = crypto.createHash("sha256").update("i-like-ninja-turtles-cool").digest();
    console.log(topic, topic.toString("hex"));
    hswarm.join(topic, {lookup: true, announce: true});
    
    hswarm.on("connection", async (socket) => {
        console.log("> New peer connected. Replicating...");

        const hrpc = new HyperRPC({dht: hswarm.dht});
        console.log(hswarm.publicKey, topic.toString("hex"));
        console.log(hswarm.dht.publicKey, topic.toString("hex"));
        // const client = hrpc.connect(socket.publicKey);


        /*
        const server = hrpc.createServer();
        await server.listen();
        console.log("! HyperRPC is ready.");

        server.respond("put", {}, async (req) => {
            const parsedData = JSON.parse(req);
            const key = parsedData.key;
            const value = parsedData.value;

            await hbee.put(key, value);
            return Buffer.from(JSON.stringify({ok: true}));
        });

        server.respond("get", {}, async (req) => {
            const parsedData = JSON.parse(req);
            const key = parsedData.key;
            const value = parsedData.value;

            const node = await hbee.get(key);
            return Buffer.from(JSON.stringify({value: node ? node.value : null}));
        });
        */

        // hcore.replicate(socket);
    });
}

main();