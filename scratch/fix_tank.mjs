import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixTank() {
    const { data, error } = await supabase.from('fuel_tank').update({ average_price: 1.50 }).eq('id', 'main');
    if (error) console.error(error);
    else console.log('Updated average price successfully');
}
fixTank();
