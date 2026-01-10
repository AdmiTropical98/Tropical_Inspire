import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
dotenv.config();

async function checkFtp() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        // Using the IP found in nslookup previously to bypass DNS propagation issues
        const host = "147.93.93.179";
        console.log(`Connecting to ${host}...`);

        await client.access({
            host: host,
            user: process.env.VITE_FTP_USERNAME,
            password: process.env.VITE_FTP_PASSWORD,
            secure: false
        });
        console.log("Connected to FTP!");

        console.log("--- ROOT LISTING ---");
        const list = await client.list("/");
        console.log(list.map(f => f.name));

        if (list.find(f => f.name === 'public_html')) {
            console.log("--- PUBLIC_HTML LISTING ---");
            const pubList = await client.list("/public_html");
            // List everything to see hidden files too potentially
            console.log(pubList.map(f => `${f.name} (Size: ${f.size})`));

            // Check for assets folder
            if (pubList.find(f => f.name === 'assets')) {
                console.log("--- ASSETS LISTING ---");
                const assetsList = await client.list("/public_html/assets");
                console.log(assetsList.map(f => f.name));
            }
        }

    } catch (err) {
        console.log("FTP Error:", err);
    }
    client.close();
}

checkFtp();
