const ftp = require("basic-ftp");

async function deploy() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "147.93.93.179",
            user: "u207374206",
            password: "Frota_Tropical1998",
            secure: false
        });
        console.log("Connected! Uploading dist directory...");
        await client.ensureDir("/"); // Assuming root of FTP is the web root, based on LFTP script which used `mirror -R ./dist /`
        await client.uploadFromDir("dist");
        console.log("Deploy complete!");
    }
    catch(err) {
        console.log("Deploy failed:", err);
    }
    client.close();
}

deploy();
