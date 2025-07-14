import Hyperswarm from "hyperswarm";
import crypto from "crypto";

const main = async () => {
    const topic = crypto.createHash("sha256").update("i-like-ninja-turtles").digest();

    const swarm = new Hyperswarm();

    swarm.join(topic, {lookup: true, announce: true});

    swarm.on("connection", (socket, details) => {
        console.log("New peer connected!");

        socket.on("data", data => {
            console.log("Received:", data.toString())
        });

        socket.write("Hello from server!")
    });

    console.log("Hyperswarm server is running...");
};

main();
