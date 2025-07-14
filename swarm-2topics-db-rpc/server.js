import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "hyperdht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const STORE_TOPIC_SEED = "cool-store-topic-1188498";
const FUNCS_TOPIC_SEED = "cool-funcs-topic-1188498";

const DHT_SEED = "8786780590d59eff60284104a08c432e516d7a699fa52a9752b2f916b4631a85";
const SWARM_SEED = "d0553361efcd25e1d81931d95b2020f29bde8bf77cd63bf7d9396cbae66e858b";
const RPC_SEED = "58f2d7d7995494f11cc246154fac40181ec494783ddd9cb4340b6a667607ecc4";

// console.log(crypto.randomBytes(32).toString("hex"));

const createStoreServer = async () => {
    const dataPath = process.argv[2] || "./data";
    console.log(`[Store] Using Hypercore data path: ${dataPath}`);
    
    const hcore = new Hypercore(dataPath);
    await hcore.ready();

    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();

    const hdth = new HyperDHT();
    await hdth.ready();

    const hswarm = new Hyperswarm({dht: hdth});

    hswarm.join(crypto.createHash("sha256").update(STORE_TOPIC_SEED).digest(), {
        server: true, client: true
    });

    hswarm.on("connection", async (socket) => {
        console.log("[Store] Replicating...");
        hcore.replicate(socket);
    });

    console.log("[Store] Hyperswarm server is running...");

    return {hcore, hbee, hswarm};
}

const createFuncsServer = async ({hbee}) => {
    const hdth = new HyperDHT();
    await hdth.ready();

    const hswarm = new Hyperswarm({dht: hdth});

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

    hswarm.join(crypto.createHash("sha256").update(FUNCS_TOPIC_SEED).digest(), {
        server: true, client: true
    });

    hswarm.on("connection", async (socket) => {
        console.log("[Funcs] Sending RPC key...");
        socket.write(hrpc.defaultKeyPair.publicKey.toString("hex"));
    });

    console.log("[Funcs] Hyperswarm server is running...");

    return {hdth, hswarm, hrpc, hrpcServer};
};

const main = async () => {
    const {hbee} = await createStoreServer();
    await createFuncsServer({hbee});
}

main();