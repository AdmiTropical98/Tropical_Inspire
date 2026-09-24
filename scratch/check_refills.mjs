import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRefills() {
    const { data, error } = await supabase.from('tank_refills')
        .select('timestamp, liters_added, price_per_liter, total_cost')
        .order('timestamp', { ascending: true });
        
    if (error) console.error(error);
    else console.table(data);
}
checkRefills();
