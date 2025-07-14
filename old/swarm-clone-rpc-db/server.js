import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("fef4ef6w5a1afa651111w1f55565a1w6fewa5622146234624345").digest();

const REPLICATION_DELAY = 5 * 1000;

const main = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();

    const hdhtKeyPair = HyperDHT.keyPair();
    
    const hcore = new Hypercore(process.argv[2] || "./data", {});
    await hcore.ready();

    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();

    const peersPublicKeysFound = new Set();
    
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const lookupPeers = async () => {
        while (true) {
            const lookup = hdht.lookup(TOPIC, hdhtKeyPair);
            for await (const result of lookup) {
                for (const peer of result.peers) {
                    const publicKeyHex = peer.publicKey.toString("hex");
                    peersPublicKeysFound.add(publicKeyHex);
                }
            }
            await sleep(5000);
        }
    };

    lookupPeers();

    const connectToReplicas = async () => {
        while (true) {
            for (const publicKeyHex of peersPublicKeysFound.values()) {
                console.log("HDHT Connecting to peer");
                const publicKey = Buffer.from(publicKeyHex, "hex");
                const hdhtClient = hrpc.connect(publicKey);
                hdhtClient.stream
                hdhtClient.on("error", (err) => {
                    console.error("HDHT Client Error:", err);
                });

                hdhtClient.end();
            }
            await sleep(5000);
        }
    }

    connectToReplicas();

    // const statusCheckField = async () => {
    //     while (true) {
    //         const result = await hbee.get("status-check");
    //         console.log("Status check field:", result?.value);
    //         await sleep(3000);
    //     }
    // };

    // statusCheckField();

    const monitorReplication = async () => {
        while (true) {
            console.log(`Hypercore: length=${hcore.length}, replicating=${hcore.replicating}, peers=${peersPublicKeysFound.size}`);
            await sleep(6000);
        }
    };

    monitorReplication();

    for await (const event of hdht.announce(TOPIC, hdhtKeyPair)) {
        // console.log("Announced event", event);
    }

    const hdhtServer = hdht.createServer(socket => {
        console.log(">>>>>>> I made a connection :)");
    });
    await hdhtServer.listen(hdhtKeyPair);

    console.log("HDHT is ready and announced");
    
    const hrpc = new HyperRPC({keyPair: hdhtKeyPair, dht: hdht});
    const hrpcServer = hrpc.createServer();
    await hrpcServer.listen();
    
    hrpcServer.respond("put", {}, async (req) => {
        const parsedData = JSON.parse(req);
        const key = parsedData.key;
        const value = parsedData.value;

        await hbee.put(key, value);
        return Buffer.from(JSON.stringify({ok: true}));
    });

    console.log("RPC server is listening");
}

main();