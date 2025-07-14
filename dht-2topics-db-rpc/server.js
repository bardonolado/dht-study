import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const DB_TOPIC = crypto.createHash("sha256").update("r23r223rwerrwer-0i1-04i12-0").digest();
const RPC_TOPIC = crypto.createHash("sha256").update("12rfr3f4-0i1-04i12-0").digest();

const FAILED_PEERS_THRESHOLD = 3;
const LOOKUP_INTERVAL = 1 * 5 * 1000;
const REPLICATION_INTERVAL = 1 * 5 * 1000;
const BAN_DURATION = 1 * 60 * 60 * 1000;
const BAN_INTERVAL = 1 * 1 * 60 * 1000;

const createHdhtDbServer = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();
    const hdhtKeyPair = hdht.defaultKeyPair;

    const hcoreKeyPair = HyperDHT.keyPair(DB_TOPIC);
    const hcore = new Hypercore(process.argv[2] || "./data", hcoreKeyPair.publicKey, {
        keyPair: hcoreKeyPair, writable: true
    });
    await hcore.ready();

    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();

    const validFoundPeers = new Set();
    const connectedPeers = new Set();
    const failedPeers = new Map();

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const cleanupExpiredBans = async () => {
        while (true) {
            for (const [publicKeyHex, failedPeerData] of failedPeers.entries()) {
                if (failedPeerData.banExpiration && new Date() > failedPeerData.banExpiration) {
                    console.log(`Removing expired ban for peer ${publicKeyHex.slice(0, 8)}`);
                    failedPeers.delete(publicKeyHex);
                }
            }
            await sleep(BAN_INTERVAL);
        }
    };
    cleanupExpiredBans();

    const replicateWithPeer = async (publicKeyHex) => {
        try {
            if (hcore.closing || hcore.closed) {
                console.log(`Cannot replicate with peer ${publicKeyHex.slice(0, 8)}: core is closing/closed`);
                return;
            }

            const publicKey = Buffer.from(publicKeyHex, "hex");

            const hdhtClient = await hdht.connect(publicKey);
            let replicationStream = null;
            
            hdhtClient.on("error", (error) => {
                console.log(`Connection error with peer ${publicKeyHex.slice(0, 8)}:`, error.message);
                handleFailedPeer(publicKeyHex);
                connectedPeers.delete(publicKeyHex);

                if (replicationStream && !replicationStream.destroyed) {
                    replicationStream.destroy();
                }
            });
            
            hdhtClient.on("close", () => {
                console.log(`Connection closed with peer ${publicKeyHex.slice(0, 8)}`);
                connectedPeers.delete(publicKeyHex);

                if (replicationStream && !replicationStream.destroyed) {
                    replicationStream.destroy();
                }
            });

            connectedPeers.add(publicKeyHex);
            
            if (!hcore.closing && !hcore.closed) {
                replicationStream = hcore.replicate(true);
                hdhtClient.pipe(replicationStream).pipe(hdhtClient);
            } else {
                console.log(`Core closed while connecting to peer ${publicKeyHex.slice(0, 8)}`);
                hdhtClient.end();
                connectedPeers.delete(publicKeyHex);
            }
        } catch (error) {
            console.log(`Failed to connect to peer ${publicKeyHex.slice(0, 8)}:`, error.message);
            handleFailedPeer(publicKeyHex);
            connectedPeers.delete(publicKeyHex);
        }
    };

    const handleFailedPeer = (publicKeyHex) => {
        const failedPeersData = failedPeers.get(publicKeyHex) || {attempts: 0, banExpiration: null};
        failedPeersData.attempts += 1;
        
        if (failedPeersData.attempts >= FAILED_PEERS_THRESHOLD) {
            failedPeersData.banExpiration = Date.now() + BAN_DURATION;
            console.log(`Removing peer ${publicKeyHex.slice(0, 8)} after ${failedPeersData.attempts} failed attempts`);
            validFoundPeers.delete(publicKeyHex);
        }
        
        failedPeers.set(publicKeyHex, failedPeersData);
    }

    const lookupPeers = async () => {
        while (true) {
            try {
                const lookup = hdht.lookup(DB_TOPIC, hdhtKeyPair);
                for await (const result of lookup) {
                    for (const peer of result.peers) {
                        const publicKeyHex = peer.publicKey.toString("hex");
                        if (connectedPeers.has(publicKeyHex) || publicKeyHex === hdhtKeyPair.publicKey.toString("hex")) {
                            continue;
                        }
                        const failedPeersData = failedPeers.get(publicKeyHex);
                        if (failedPeersData?.attempts >= FAILED_PEERS_THRESHOLD) {
                            continue;
                        }
                        validFoundPeers.add(publicKeyHex);
                        await replicateWithPeer(publicKeyHex);
                    }
                }
            } catch (error) {
                console.error("Error during peer lookup:", error.message);
            }
            await sleep(LOOKUP_INTERVAL);
        }
    };
    lookupPeers();

    const connectToReplicas = async () => {
        while (true) {
            if (hcore.closing || hcore.closed) {
                console.log("Core is closing/closed, stopping replica connections");
                break;
            }
            
            for (const publicKeyHex of validFoundPeers.values()) {
                if (connectedPeers.has(publicKeyHex) || publicKeyHex === hdhtKeyPair.publicKey.toString("hex")) {
                    continue;
                }
                const failedPeersData = failedPeers.get(publicKeyHex);
                if (failedPeersData?.attempts >= FAILED_PEERS_THRESHOLD) {
                    continue;
                }
                await replicateWithPeer(publicKeyHex);
            }
            await sleep(REPLICATION_INTERVAL);
        }
    }
    connectToReplicas();

    const startAnnouncement = async () => {
        try {
            for await (const event of hdht.announce(DB_TOPIC, hdhtKeyPair)) {
                
            }
        } catch (error) {
            console.log("Announcement error:", error.message);
        }
    };
    startAnnouncement();

    const monitorReplication = async () => {
        while (true) {
            try {
                if (!hcore.closing && !hcore.closed) {
                    const replicationField = await hbee.get("replication").catch(() => null);
                    console.log(`Hypercore: length=${hcore.length}, field=${replicationField?.value || 'null'} replicating=${hcore.replicating}, peers=${validFoundPeers.size}`);
                } else {
                    console.log("Core is closing/closed, stopping monitoring");
                    break;
                }
            } catch (error) {
                console.log("Error in monitoring:", error.message);
            }
            await sleep(6000);
        }
    };
    monitorReplication();

    const hdhtServer = hdht.createServer(socket => {
        try {
            if (!hcore.closing && !hcore.closed) {
                const replicationStream = hcore.replicate(false);
                socket.pipe(replicationStream).pipe(socket);
                
                socket.on("error", (error) => {
                    console.log("Socket error in DHT server:", error.message);
                    if (!replicationStream.destroyed) {
                        replicationStream.destroy();
                    }
                });
                
                socket.on("close", () => {
                    if (!replicationStream.destroyed) {
                        replicationStream.destroy();
                    }
                });
            } else {
                console.log("Rejecting connection: core is closing/closed");
                socket.end();
            }
        } catch (error) {
            console.log("Error in DHT server handler:", error.message);
            socket.end();
        }
    });
    await hdhtServer.listen(hdhtKeyPair);

    console.log(`DHT Server listening on public key: ${hdhtKeyPair.publicKey.toString("hex").slice(0, 16)}...`);

    return {hdht, hcore, hbee, hdhtServer};
}

const createRpcServer = async ({hbee}) => {
    const hdht = new HyperDHT();
    await hdht.ready();
    const hdhtKeyPair = hdht.defaultKeyPair;

    const startAnnouncement = async () => {
        try {
            for await (const event of hdht.announce(RPC_TOPIC, hdhtKeyPair)) {
                
            }
        } catch (error) {
            console.log("Announcement error:", error.message);
        }
    };
    startAnnouncement();

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

    console.log(`RPC Server listening on public key: ${hdhtKeyPair.publicKey.toString("hex").slice(0, 16)}...`);

    return {hdht, hrpcServer};
}

const main = async () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const {hdht, hcore, hbee, hdhtServer} = await createHdhtDbServer();
    await createRpcServer({hbee});

    process.on("SIGINT", async () => {
        console.log("Shutting down gracefully...");
        try {
            await hdhtServer.close();
            
            await sleep(1000);

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