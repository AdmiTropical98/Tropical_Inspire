import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRecent() {
    const { data, error } = await supabase.from('fuel_transactions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);
        
    if (error) console.error(error);
    else console.table(data.map(t => ({ id: t.id, time: t.timestamp, is_ext: t.is_external, price: t.price_per_liter })));
}
checkRecent();
