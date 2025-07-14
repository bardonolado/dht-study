import Hyperswarm from "hyperswarm";
import Corestore from "corestore";
import Hyperbee from "hyperbee";
import RPC from "@hyperswarm/rpc";

const main = async () => {
    const store = new Corestore("./store");
    const core = store.get({ name: "my-hyperbee" });
    await core.ready();
    const bee = new Hyperbee(core, {keyEncoding: "utf-8", valueEncoding: "utf-8"});
    await bee.ready();

    const rpc = new RPC({});

    const server = rpc.createServer()
    await server.listen();

    server.respond("put", {}, async (req) => {
        const parsedData = JSON.parse(req);
        const key = parsedData.key;
        const value = parsedData.value;

        await bee.put(key, value);
        return Buffer.from(JSON.stringify({ok: true}));
    });

    server.respond("get", {}, async (req) => {
        const parsedData = JSON.parse(req);
        const key = parsedData.key;
        const value = parsedData.value;

        const node = await bee.get(key);
        return Buffer.from(JSON.stringify({value: node ? node.value : null}));
    });

    console.log("Server public key:", server.publicKey.toString("hex"));
}

main();
