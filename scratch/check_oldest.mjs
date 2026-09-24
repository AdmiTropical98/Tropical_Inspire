import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkOldest() {
    console.log("Fetching oldest 10 manual transactions...");
    const { data, error } = await supabase
        .from('fuel_transactions')
        .select('timestamp, liters, vehicle_id')
        .eq('is_external', false)
        .order('timestamp', { ascending: true })
        .limit(10);
    
    if (error) console.error(error);
    else console.log(data);
}

checkOldest();
