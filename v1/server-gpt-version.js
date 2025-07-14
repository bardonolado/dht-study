import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("r13j41j4124k3331m12ic40123131231-0i1-04i12-0").digest();

const REPLICATION_DELAY = 5 * 1000;

const createHdhtDbServer = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();
    const hdhtKeyPair = hdht.defaultKeyPair;

    const hcoreKeyPair = HyperDHT.keyPair(TOPIC);
    const hcore = new Hypercore(process.argv[2] || "./data", hcoreKeyPair.publicKey, {
        keyPair: hcoreKeyPair, writable: true
    });
    await hcore.ready();

    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();

    const peersPublicKeysFound = new Set();
    const connectedPeers = new Set();
    const failedPeers = new Map(); // Track failed connection attempts with timestamps
    const maxRetries = 3;
    const retryDelay = 30000; // 30 seconds between retries
    const staleTimeout = 300000; // Remove peers after 5 minutes of failed connections

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
            const currentTime = Date.now();
            
            // Clean up stale peers
            for (const [publicKeyHex, failureInfo] of failedPeers.entries()) {
                if (currentTime - failureInfo.lastAttempt > staleTimeout) {
                    console.log(`Removing stale peer ${publicKeyHex.slice(0, 8)} after ${failureInfo.attempts} failed attempts`);
                    peersPublicKeysFound.delete(publicKeyHex);
                    failedPeers.delete(publicKeyHex);
                }
            }
            
            for (const publicKeyHex of peersPublicKeysFound.values()) {
                if (connectedPeers.has(publicKeyHex) || publicKeyHex === hdhtKeyPair.publicKey.toString("hex")) {
                    continue;
                }
                
                // Check if peer has failed too many times recently
                const failureInfo = failedPeers.get(publicKeyHex);
                if (failureInfo) {
                    if (failureInfo.attempts >= maxRetries) {
                        // Skip if we haven't waited long enough for retry
                        if (currentTime - failureInfo.lastAttempt < retryDelay) {
                            continue;
                        }
                        // Reset attempts after retry delay
                        failureInfo.attempts = 0;
                    }
                }
                
                const publicKey = Buffer.from(publicKeyHex, "hex");

                try {
                    console.log(`Attempting to connect to peer ${publicKeyHex.slice(0, 8)}...`);
                    
                    // Add connection timeout
                    const connectPromise = hdht.connect(publicKey, { timeout: 10000 });
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 10000)
                    );
                    
                    const hdhtClient = await Promise.race([connectPromise, timeoutPromise]);
                    
                    connectedPeers.add(publicKeyHex);
                    failedPeers.delete(publicKeyHex); // Remove from failed list on successful connection
                    
                    console.log(`Successfully connected to peer ${publicKeyHex.slice(0, 8)}`);
                    
                    hdhtClient.on('error', (err) => {
                        console.log(`Connection error with peer ${publicKeyHex.slice(0, 8)}:`, err.message);
                        connectedPeers.delete(publicKeyHex);
                    });
                    
                    hdhtClient.on('close', () => {
                        console.log(`Connection closed with peer ${publicKeyHex.slice(0, 8)}`);
                        connectedPeers.delete(publicKeyHex);
                    });
                    
                    hdhtClient.pipe(hcore.replicate(true)).pipe(hdhtClient);
                } catch (error) {
                    console.log(`Failed to connect to peer ${publicKeyHex.slice(0, 8)}:`, error.message);
                    
                    // Track failed attempts
                    const currentFailureInfo = failedPeers.get(publicKeyHex) || { attempts: 0, lastAttempt: 0 };
                    currentFailureInfo.attempts += 1;
                    currentFailureInfo.lastAttempt = currentTime;
                    failedPeers.set(publicKeyHex, currentFailureInfo);
                    
                    // Remove from connected peers if it was there
                    connectedPeers.delete(publicKeyHex);
                    
                    // If we've exceeded max retries, mark for potential removal
                    if (currentFailureInfo.attempts >= maxRetries) {
                        console.log(`Peer ${publicKeyHex.slice(0, 8)} failed ${currentFailureInfo.attempts} times, will retry after delay`);
                    }
                }
            }
            await sleep(5000);
        }
    }

    connectToReplicas();

    const startAnnouncement = async () => {
        try {
            console.log(`Starting announcement for topic: ${TOPIC.toString('hex').slice(0, 16)}...`);
            for await (const event of hdht.announce(TOPIC, hdhtKeyPair)) {
                console.log('Announcement event:', event);
            }
        } catch (error) {
            console.log("Announcement error:", error.message);
            // Restart announcement after a delay
            await sleep(5000);
            console.log("Restarting announcement...");
            startAnnouncement();
        }
    };
    
    startAnnouncement();

    const monitorReplication = async () => {
        while (true) {
            const activeConnections = connectedPeers.size;
            const failedPeersCount = failedPeers.size;
            const totalPeersFound = peersPublicKeysFound.size;
            
            console.log(`Hypercore: length=${hcore.length}, field=${await hbee.get("replication")} replicating=${hcore.replicating}`);
            console.log(`Peers: total=${totalPeersFound}, connected=${activeConnections}, failed=${failedPeersCount}`);
            
            if (failedPeersCount > 0) {
                console.log('Failed peers status:');
                for (const [publicKeyHex, failureInfo] of failedPeers.entries()) {
                    const timeSinceLastAttempt = Math.round((Date.now() - failureInfo.lastAttempt) / 1000);
                    console.log(`  ${publicKeyHex.slice(0, 8)}: ${failureInfo.attempts} attempts, last tried ${timeSinceLastAttempt}s ago`);
                }
            }
            
            await sleep(6000);
        }
    };

    monitorReplication();

    const hdhtServer = hdht.createServer(socket => {
        socket.pipe(hcore.replicate(false)).pipe(socket);
    });
    
    await hdhtServer.listen(hdhtKeyPair);
    console.log(`DHT Server listening on public key: ${hdhtKeyPair.publicKey.toString("hex").slice(0, 16)}...`);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down gracefully...');
        try {
            await hdhtServer.close();
            await hdht.destroy();
            await hcore.close();
            console.log('Server shut down successfully');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
    
    return { hdht, hcore, hbee, hdhtServer };
}

const main = async () => {
   await createHdhtDbServer();
}

main();