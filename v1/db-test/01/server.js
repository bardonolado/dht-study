import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import crypto from "crypto";
import path from "path";

const main = async () => {
    const dataPath = process.argv[2] || "./data";
    console.log(`Using Hypercore data path: ${dataPath}`);
    
    const core = new Hypercore(dataPath);

    core.ready(() => {
        console.log("Core key:", core.key.toString("hex"));
    });

    const db = new Hyperbee(core, {keyEncoding: "utf-8", valueEncoding: "json"});

    const swarm = new Hyperswarm();

    const topic = crypto.createHash("sha256").update("i-like-ninja-turtles").digest();

    swarm.join(topic, {lookup: true, announce: true});

    swarm.on("connection", (socket) => {
        console.log("New peer connected! Replicating...");
        core.replicate(socket);
    });

    await core.ready();
    
    console.log("Core ready.");

    const sleep = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    while (true) {
        const foo = await db.get("foo");
        console.log("foo ->", foo?.value);
        await sleep(5000);
    }
}

main();