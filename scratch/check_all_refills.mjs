import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRefills() {
    const { data, error } = await supabase.from('tank_refills').select('*');
    if (error) console.error(error);
    else console.log(`Total tank refills in DB: ${data.length}`);
    if (data) console.table(data.map(r => ({ date: r.timestamp, liters: r.liters_added, price: r.price_per_liter })));
}
checkRefills();
