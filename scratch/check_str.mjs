import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkStr() {
    const { data: txs } = await supabase.from('fuel_transactions').select('vehicle_id, timestamp').ilike('vehicle_id', '%AS%');
    console.log(`Transactions with AS in vehicle_id: ${txs.length}`);
    if (txs.length > 0) console.log(txs);
}

checkStr();
