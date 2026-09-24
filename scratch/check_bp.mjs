import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkBP() {
    console.log("Fetching all BP (external) transactions...");
    const { data, error } = await supabase
        .from('fuel_transactions')
        .select('timestamp, is_external')
        .eq('is_external', true)
        .order('timestamp', { ascending: true })
        .limit(10);
    
    if (error) console.error("DB error:", error);
    else console.log(data);
}

checkBP();
