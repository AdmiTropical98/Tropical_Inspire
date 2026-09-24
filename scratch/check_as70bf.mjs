import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTx() {
    const vids = ['a9a0065e-90df-4dd5-872b-2965a93b4a7d', '4ceb4809-2b0c-4954-a897-ffe643bdce7a'];
    const { data: txs } = await supabase.from('fuel_transactions').select('*').in('vehicle_id', vids);
    console.log(`Found ${txs.length} transactions for AS-70-BF.`);
}

checkTx();
