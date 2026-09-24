import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
    const { data, error } = await supabase.from('fuel_tank').update({ baseline_totalizer: 1000 }).eq('id', 'main');
    console.log("Error:", error);
}
testUpdate();
