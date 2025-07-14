import Hyperswarm from "hyperswarm";
import Corestore from "corestore";
import Hyperbee from "hyperbee";
import RPC from "@hyperswarm/rpc";

const publicKey = "beb592070357d911c08e889180e5561fd258af36563f70ef167c5aaeb0c9ea6c";

const main = async () => {
    const rpc = new RPC({

    });

    const client = rpc.connect(Buffer.from(publicKey, "hex"));

    await client.request("put", Buffer.from(JSON.stringify({key: "foo", value: Math.random().toString()})));
    const result = await client.request("get", Buffer.from(JSON.stringify({key: "foo"})));
    console.log("Result:", JSON.parse(result));
}

main();
