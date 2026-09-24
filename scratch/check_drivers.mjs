import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDrivers() {
    const { data: txs } = await supabase.from('fuel_transactions').select('driver_id').eq('is_external', false);
    
    let validCount = 0;
    let nullCount = 0;
    
    txs.forEach(t => {
        if (t.driver_id === null) nullCount++;
        else validCount++;
    });
    
    console.log(`Manual TXs with driver_id: ${validCount}`);
    console.log(`Manual TXs with NULL driver_id: ${nullCount}`);
}

checkDrivers();
