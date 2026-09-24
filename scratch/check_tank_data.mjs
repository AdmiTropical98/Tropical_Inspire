import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTank() {
    const { data, error } = await supabase.from('fuel_tank').select('*');
    if (error) console.error(error);
    else console.log(data);
}
checkTank();
