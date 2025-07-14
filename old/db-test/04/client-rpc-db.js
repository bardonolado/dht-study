import Hyperswarm from "hyperswarm";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";

const FUNCS_TOPIC_SEED = "cool-funcs-topic-1188498";

const main = async () => {
    const hswarm = new Hyperswarm();

    const hrpc = new HyperRPC();

    const remoteRpcKeys = [];

    hswarm.join(crypto.createHash("sha256").update(FUNCS_TOPIC_SEED).digest(), {
        server: false, client: true
    });

    hswarm.on("connection", async (socket, details) => {
        console.log("Connected...");

        socket.on("data", async (data) => {
            console.log("Received:", data.toString());

            const serverHrpcPublicKey = Buffer.from(data.toString(), "hex");
            remoteRpcKeys.push(serverHrpcPublicKey);
        });

        socket.write("OK");
    });

    console.log("Hyperswarm client is running...");

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        const randomRpcKey = remoteRpcKeys[Math.floor(Math.random() * remoteRpcKeys.length)];
        if (!randomRpcKey) {
            await sleep(1500);
            continue;
        }

        const hrpcClient = hrpc.connect(randomRpcKey);

        const result1 = await hrpcClient.request("get", Buffer.from(JSON.stringify({key: "foo"})));
        console.log("Result1:", JSON.parse(result1));

        const result2 = await hrpcClient.request("put", Buffer.from(JSON.stringify({key: "foo", value: Math.random().toString()})));
        console.log("Result2:", JSON.parse(result2));
        
        const result3 = await hrpcClient.request("get", Buffer.from(JSON.stringify({key: "foo"})));
        console.log("Result3':", JSON.parse(result3));

        hrpcClient.end();
        
        await sleep(1500);
    }
}

main();