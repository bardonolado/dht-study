import Hyperswarm from "hyperswarm";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import HyperDHT from "@hyperswarm/dht";
import HyperRPC from "@hyperswarm/rpc";
import crypto from "crypto";
import path from "path";

const TOPIC = crypto.createHash("sha256").update("eeda984d9429d42a4d8a492d41").digest();

const main = async () => {
    const hdht = new HyperDHT();
    await hdht.ready();

    const hdhtKeyPair = HyperDHT.keyPair();
    
    const hrpc = new HyperRPC({keyPair: hdhtKeyPair, dht: hdht});

    const peersPublicKeysFound = new Set();
    
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const lookupPeers = async () => {
        while (true) {
            const lookup = hdht.lookup(TOPIC, hdhtKeyPair);
            for await (const result of lookup) {
                for (const peer of result.peers) {
                    const publicKeyHex = peer.publicKey.toString("hex");
                    peersPublicKeysFound.add(publicKeyHex);
                }
            }
            await sleep(5000);
        }
    };

    lookupPeers();

    const connectAndCallRPC = async () => {
        while (true) {
            for (const publicKeyHex of peersPublicKeysFound.values()) {
                console.log("Connecting to peer:", publicKeyHex);
                const publicKey = Buffer.from(publicKeyHex, "hex");
                const hrpcClient = hrpc.connect(publicKey);
                
                try {
                    const response = await hrpcClient.request("clone", Buffer.from(JSON.stringify({key: "foo"})));
                    console.log("RPC Response:", response.toString());
                } catch (error) {
                    peersPublicKeysFound.delete(publicKeyHex);
                    console.error("RPC Error:", error);
                }
            }
            await sleep(1000);
        }
    }

    connectAndCallRPC();

    console.log("HDHT is ready and announced");
}

main();

/*
{
  token: <Buffer 31 21 34 60 fe d4 e5 55 94 e7 ad 57 2f 06 7a dc 1d 2b 41 73 57 8f 77 00 83 2c 9a 29 0b 53 d1 66>,
  from: {
    id: <Buffer 5f 0f 08 60 7b c6 ea de 09 ef 66 b3 6f 28 b6 f2 85 80 5a aa fb a1 03 a3 42 88 22 f5 76 a1 92 7e>,
    host: '158.220.113.162',
    port: 49738
  },
  to: { id: null, host: '189.68.128.144', port: 35417 },
  peers: [
    {
      publicKey: <Buffer 32 52 28 47 98 b2 39 a7 dc f9 65 05 cf e3 e0 0e 63 88 0a 78 69 bc 32 4d 11 e9 e8 e3 19 6f 88 a5>,
      relayAddresses: []
    }
  ]
}
*/