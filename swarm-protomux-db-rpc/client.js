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
    const hdht = new HyperDHT();
    await hdht.ready();

    const hswarm = new Hyperswarm({dht: hdht});

    const openMrpcs = [];

    hswarm.join(TOPIC, {server: false, client: true});

    hswarm.on("connection", async (socket, details) => {
        console.log("Connected...");

        const mux = new Protomux(socket);
        const mrpc = new ProtomuxRPC(mux, {id: Buffer.from("rpc-channel")});

        openMrpcs.push(mrpc);
    });

    console.log("Hyperswarm client is running...");

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        const randomMrpcs = openMrpcs[Math.floor(Math.random() * openMrpcs.length)];
        if (!randomMrpcs) {
            await sleep(1500);
            continue;
        }

        const putRes = await randomMrpcs.request("put", Buffer.from(JSON.stringify({key: "test", value: Math.random().toString()})));
        console.log("PUT response:", putRes.toString());

        const getRes = await randomMrpcs.request("get", Buffer.from(JSON.stringify({key: "test"})));
        console.log("GET response:", getRes.toString());

        await sleep(1500);
    }
}

main();