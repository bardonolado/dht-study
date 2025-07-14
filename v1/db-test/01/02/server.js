import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import crypto from "crypto";
import path from "path";

const main = async () => {
    const dataPath = process.argv[2] || "./data";
    console.log(`! Using Hypercore data path: ${dataPath}`);

    const hcore = new Hypercore(dataPath);
    await hcore.ready();
    console.log("! Hypercore is ready.");
    console.log("! Hypercore key:", hcore.key.toString("hex"));
    
    const hbee = new Hyperbee(hcore, {keyEncoding: "utf-8", valueEncoding: "json"});
    await hbee.ready();
    console.log("! Hyperbee is ready.");

    const hswarm = new Hyperswarm();

    const topic = crypto.createHash("sha256").update("i-like-ninja-turtles").digest();

    hswarm.join(topic, {lookup: true, announce: true});

    hswarm.on("connection", (socket) => {
        console.log("> New peer connected. Replicating...");
        hcore.replicate(socket);
    });
}

main();