
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to fix encoding/formatting issues
const connectionString = 'postgres://postgres:Frota_Tropical1998@db.ptfgevdwcrwepkojrrnp.supabase.co:5432/postgres';

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL');

        const schemaPath = path.resolve(__dirname, '../schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');

        // Split commands by semicolon to handle potential valid parser issues if any, 
        // but usually client.query supports simple scripts. 
        // Supabase postgres usually supports multiple statements in one query.
        await client.query(sql);

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
