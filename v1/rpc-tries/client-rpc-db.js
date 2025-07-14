import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "hyperdht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const FUNCS_TOPIC_SEED = "cool-funcs-topic-1188498";

const main = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();

    const discovery = hdht.announce(FUNCS_TOPIC_SEED);
    discovery.on("peer", async (peer) => {
        console.log("Found peer:", peer);
        const client = hrpc.connect(peer.publicKey);

        client.on("open", () => {
            console.log("Connected to peer:", peer.publicKey.toString("hex"));
            foundPeers.set(peer.publicKey.toString("hex"), client);
            // synchronizeAuctionData(client);
        });

        client.on("close", () => {
            console.log("Peer disconnected:", peer.publicKey.toString("hex"));
            foundPeers.delete(peer.publicKey.toString("hex"));
        });

        client.on("error", (err) => {
            console.error("Peer connection error:", err);
            foundPeers.delete(peer.publicKey.toString("hex"));
        });
    });
}

main();