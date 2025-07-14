import StoreFacility from "../../hp-svc-facs-store/index.js";

const main = async () => {
    const strFac = new StoreFacility({}, {storeDir: "./data"}, {});
    strFac.init();

    
    strFac.start((x) => {
        console.log(x);
        strFac.swarmBase(strFac.getBase());
    });

    strFac.on("ready", () => {
        console.log("StoreFacility is ready!");
    });

    strFac.on("connection", () => {
        console.log("StoreFacility is connection!");
    });
    
}

main();
