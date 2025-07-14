import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("123123dpo23rp2k3o").digest();

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
    const connectedPeers = new Set();
    
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
                // Skip if already connected or if it's our own key
                if (connectedPeers.has(publicKeyHex) || publicKeyHex === hdhtKeyPair.publicKey.toString('hex')) {
                    continue;
                }
                
                console.log("HDHT Connecting to peer:", publicKeyHex);
                const publicKey = Buffer.from(publicKeyHex, "hex");

                try {
                    const hdhtClient = await hdht.connect(publicKey);
                    console.log("Successfully connected to peer:", publicKeyHex);
                    connectedPeers.add(publicKeyHex);
                    
                    hdhtClient.on('error', (error) => {
                        console.log("Connection error with peer:", publicKeyHex, error.message);
                        connectedPeers.delete(publicKeyHex);
                    });
                    
                    hdhtClient.on('close', () => {
                        console.log("Connection closed with peer:", publicKeyHex);
                        connectedPeers.delete(publicKeyHex);
                    });
                    
                    // Keep connection alive for potential replication
                    // hdhtClient.end();
                } catch (error) {
                    console.log("HDHT Connection failed for peer:", publicKeyHex, error.message);
                    // Remove peer from found set if connection consistently fails
                    peersPublicKeysFound.delete(publicKeyHex);
                }
            }
            await sleep(5000);
        }
    }

    connectToReplicas();

    for await (const event of hdht.announce(TOPIC, hdhtKeyPair)) {
        // console.log("Announced event", event);
    }

    const hdhtServer = hdht.createServer(socket => {
        console.log(">>>>>>> I made a connection :)");
        
        socket.on('error', (error) => {
            console.log("Socket error:", error.message);
        });
        
        socket.on('close', () => {
            console.log("Socket closed");
        });
    });
    await hdhtServer.listen(hdhtKeyPair);

    console.log("HDHT is ready and announced");
}

main();