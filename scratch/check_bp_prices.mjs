import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkBPPrices() {
    const { data, error } = await supabase.from('fuel_transactions')
        .select('timestamp, is_external, price_per_liter, total_cost, liters')
        .eq('is_external', true)
        .limit(5);
        
    if (error) console.error(error);
    else console.table(data);
}
checkBPPrices();
