import Hyperswarm from "hyperswarm";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";

const TOPIC_SEED = "cool-topic1188498";

const main = async () => {
    const hswarm = new Hyperswarm();

    const hrpc = new HyperRPC();

    hswarm.join(crypto.createHash("sha256").update(TOPIC_SEED).digest(), {
        server: false, client: true
    });

    hswarm.on("connection", async (socket, details) => {
        console.log("Connected to peer!");

        socket.on("data", async (data) => {
            console.log("Received:", data.toString());

            const serverHrpcPublicKey = Buffer.from(data.toString(), "hex");
            const hrpcClient = hrpc.connect(serverHrpcPublicKey);

            console.log("calling");

            const result1 = await hrpcClient.request("get", Buffer.from(JSON.stringify({key: "foo"})));
            console.log("Result:", JSON.parse(result1));

            const result2 = await hrpcClient.request("put", Buffer.from(JSON.stringify({key: "foo", value: Math.random().toString()})));
            console.log("Result:", JSON.parse(result2));
            
            const result3 = await hrpcClient.request("get", Buffer.from(JSON.stringify({key: "foo"})));
            console.log("Result:", JSON.parse(result3));

            hrpcClient.end();
        });

        socket.write("OK");
    });

    console.log("Hyperswarm client is running...");
}

main();