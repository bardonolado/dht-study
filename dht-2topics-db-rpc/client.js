import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const RPC_TOPIC = crypto.createHash("sha256").update("12rfr3f4-0i1-04i12-0").digest();

const FAILED_PEERS_THRESHOLD = 3;
const LOOKUP_INTERVAL = 1 * 5 * 1000;
const REPLICATION_INTERVAL = 1 * 5 * 1000;
const BAN_DURATION = 1 * 60 * 60 * 1000;
const BAN_INTERVAL = 1 * 1 * 60 * 1000;
const RPC_CALLS_INTERVAL = 1 * 1 * 1000;

const main = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();

    const hdhtKeyPair = HyperDHT.keyPair();
    
    const hrpc = new HyperRPC({keyPair: hdhtKeyPair, dht: hdht});

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
                const lookup = hdht.lookup(RPC_TOPIC, hdhtKeyPair);
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
                    }
                }
            } catch (error) {
                console.error("Error during peer lookup:", error.message);
            }
            await sleep(LOOKUP_INTERVAL);
        }
    };
    lookupPeers();

    const connectAndCallRPCs = async () => {
        while (true) {
            for (const publicKeyHex of validFoundPeers.values()) {
                if (connectedPeers.has(publicKeyHex) || publicKeyHex === hdhtKeyPair.publicKey.toString("hex")) {
                    continue;
                }
                const failedPeersData = failedPeers.get(publicKeyHex);
                if (failedPeersData?.attempts >= FAILED_PEERS_THRESHOLD) {
                    continue;
                }
                try {
                    const publicKey = Buffer.from(publicKeyHex, "hex");
                    const hrpcClient = hrpc.connect(publicKey);
                    
                    let connectionClosed = false;
                
                    hrpcClient.on("error", (error) => {
                        console.log(`Connection error with peer ${publicKeyHex.slice(0, 8)}:`, error.message);
                        connectionClosed = true;
                        handleFailedPeer(publicKeyHex);
                        connectedPeers.delete(publicKeyHex);
                    });
                    
                    hrpcClient.on("close", () => {
                        console.log(`Connection closed with peer ${publicKeyHex.slice(0, 8)}`);
                        connectionClosed = true;
                        connectedPeers.delete(publicKeyHex);
                    });

                    if (!connectionClosed && !hrpcClient.destroyed) {
                        connectedPeers.add(publicKeyHex);
                        const response = await hrpcClient.request("put", Buffer.from(JSON.stringify({key: "status-check", value: Math.random().toString()})));
                        console.log("RPC Response:", response.toString());
                    }
                    
                    if (!hrpcClient.destroyed) {
                        hrpcClient.end();
                    }
                    connectedPeers.delete(publicKeyHex);
                } catch (error) {
                    console.log(`Failed to connect to peer ${publicKeyHex.slice(0, 8)}:`, error.message);
                    handleFailedPeer(publicKeyHex);
                    connectedPeers.delete(publicKeyHex);
                }
            }
            await sleep(RPC_CALLS_INTERVAL);
        }
    }
    connectAndCallRPCs();

    console.log("HDHT is ready and announced");
}

main();