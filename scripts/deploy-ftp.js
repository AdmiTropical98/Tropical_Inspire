import { Client } from 'basic-ftp';
import dotenv from 'dotenv';
dotenv.config();

async function deploy() {
    const client = new Client();
    // Enable verbose logging to debug connection issues
    client.ftp.verbose = true;

    const config = {
        host: process.env.FTP_SERVER,
        user: process.env.FTP_USERNAME,
        password: process.env.FTP_PASSWORD,
        port: 21,
        // Explicit FTPS with loose security to accept self-signed certs often found on shared hosting
        secure: true,
        secureOptions: {
            rejectUnauthorized: false
        }
    };

    console.log(`Attempting connection to ${config.host} on port ${config.port}...`);

    try {
        await client.access(config);
        console.log("✅ API Connection Established.");

        console.log("📦 Starting Upload of 'dist' folder...");
        // Upload the contents of 'dist' to the root '/' of the FTP server
        // ensuring the destination directory is clean is risky without backup, 
        // so we just overwrite.
        await client.uploadFromDir("dist", "/");

        console.log("🚀 Deployment Complete!");
    } catch (err) {
        console.error("❌ Deployment Failed:", err);
        process.exit(1);
    } finally {
        client.close();
    }
}

deploy();
