import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import Protomux from "protomux";
import ProtomuxRPC from "protomux-rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("ek12190ie201dosakdpak1").digest();

const main = async () => {
    const dataPath = process.argv[2] || "./data";
    console.log(`[Store] Using Hypercore data path: ${dataPath}`);
    
    const hdht = new HyperDHT();
    await hdht.ready();

    const hcoreKeyPair = HyperDHT.keyPair(TOPIC);
    const hcore = new Hypercore(process.argv[2] || "./data", hcoreKeyPair.publicKey, {
        keyPair: hcoreKeyPair, writable: true
    });
    await hcore.ready();

    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();

    const hswarm = new Hyperswarm({dht: hdht});

    hswarm.join(TOPIC, {server: true, client: true});

    hswarm.on("connection", async (socket) => {
        console.log("Connected to a new peer, replicating...");

        const mux = new Protomux(socket);
        hcore.replicate(mux);

        const mrpc = new ProtomuxRPC(mux, {id: Buffer.from("rpc-channel")});

        mrpc.respond("put", {}, async (req) => {
            const parsedData = JSON.parse(req);
            const key = parsedData.key;
            const value = parsedData.value;

            await hbee.put(key, value);
            return Buffer.from(JSON.stringify({ok: true}));
        });

        mrpc.respond("get", {}, async (req) => {
            const parsedData = JSON.parse(req);
            const key = parsedData.key;

            const result = await hbee.get(key);
            return Buffer.from(JSON.stringify({value: result ? result.value : null}));
        });

        console.log("RPC connection is ready");
    });

    setInterval(async () => {
        console.log(">>>", await hbee.get("test"));
    }, 1000);

    process.on("SIGINT", async () => {
        console.log("Shutting down gracefully...");
        try {
            await hcore.close();
            await hbee.close();

            await hdht.destroy();
            
            process.exit(0);
        } catch (error) {
            console.error("Error during shutdown:", error);
            process.exit(1);
        }
    });
}

main();