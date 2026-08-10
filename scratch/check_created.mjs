import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCreatedAt() {
    const { data, error } = await supabase.from('fuel_transactions')
        .select('id, timestamp, created_at, price_per_liter')
        .eq('is_external', false)
        .order('timestamp', { ascending: false })
        .limit(5);
        
    if (error) console.error(error);
    else console.table(data);
}
checkCreatedAt();
