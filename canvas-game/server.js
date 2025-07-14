import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import Protomux from "protomux";
import ProtomuxRPC from "protomux-rpc";
import crypto from "crypto";
import path from "path";
import express from 'express';

const TOPIC = crypto.createHash("sha256").update("4d4aw8d8a4d4d4d4d4d4ewew").digest();

const main = async () => {
    const dataPath = process.argv[2] || "./storage";
    const serverPort = process.argv[3] || 3000;
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

        mrpc.respond("drawPixel", {}, async (req) => {
            const {x, y, color} = JSON.parse(req);
            await hbee.put(`${x},${y}`, {color})
            console.log(`Pixel set: ${x},${y} -> ${color}`);
        })

        console.log("RPC connection is ready");
    });

    const httpServer = express();
    httpServer.use(express.static("public"));

    httpServer.get("/pixels", async (req, res) => {
        const pixels = [];
        for await (const {key, value} of hbee.createReadStream()) {
            const [x, y] = key.split(",").map(Number);
            pixels.push({x, y, color: value.color});
        }
        return res.status(200).json(pixels);
    });

    httpServer.post("/pixel", express.json(), async (req, res) => {
        const {x, y, color} = req.body;
        await hbee.put(`${x},${y}`, {color});
        console.log(`Received pixel update: ${x},${y} -> ${color}`);

        // Broadcast to peers
        // hswarm.peers.forEach(async (peer) => {
        //     const mux = new Protomux(peer);
        //     const mrpc = new ProtomuxRPC(mux, {id: Buffer.from("rpc-channel")});
        //     await mrpc.request("drawPixel", JSON.stringify({x, y, color}));
        // });

        return res.status(200).json({status: "ok"});
    });

    httpServer.listen(serverPort, () => {
        console.log(`Web server is running on http://localhost:${serverPort}`);
    });

    process.on("SIGINT", async () => {
        console.log("Shutting down gracefully...");
        try {
            await hcore.close();
            await hbee.close();

            await hdht.destroy();

            await hswarm.destroy();
            
            process.exit(0);
        } catch (error) {
            console.error("Error during shutdown:", error);
            process.exit(1);
        }
    });
}

main();