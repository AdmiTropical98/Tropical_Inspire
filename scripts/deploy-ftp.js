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
        // Hostinger often blocks passive SSL connections from CI/CD. 
        // Reverting to plain FTP to prevent ETIMEDOUT during TLS handshake.
        secure: false
    };

    console.log(`Attempting PLAINTEXT connection to ${config.host} on port ${config.port}...`);

    try {
        await client.access(config);
        console.log("✅ API Connection Established.");

        console.log("📦 Starting Upload to 'public_html'...");
        // Ensure remote dir exists
        await client.ensureDir("public_html");
        await client.uploadFromDir("dist", "public_html");

        console.log("🚀 Deployment Complete!");
    } catch (err) {
        console.error("❌ Deployment Failed:", err);
        process.exit(1);
    } finally {
        client.close();
    }
}

deploy();
