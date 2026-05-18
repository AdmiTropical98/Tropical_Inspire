
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    host: 'db.ptfgevdwcrwepkojrrnp.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'Frota_Tropical1998',
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

async function updateDb() {
    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL');

        console.log('Adding cartrack_id and current_vehicle columns to motoristas table...');

        const sql = `
            ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS cartrack_id TEXT;
            ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS current_vehicle TEXT;
        `;

        await client.query(sql);

        console.log('Database updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Update failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

updateDb();
