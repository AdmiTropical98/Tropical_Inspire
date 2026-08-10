import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('Fetching latest 50 fuel_transactions regardless of date...');
    const { data, error } = await supabase
        .from('fuel_transactions')
        .select('*')
        // We cannot rely on timestamp if it's messed up. Let's just fetch everything and sort manually? No, we can order by timestamp desc.
        .order('timestamp', { ascending: false })
        .limit(20);
        
    if (error) {
        console.error("DB error:", error);
        return;
    }
    
    console.log("Found rows:", data.length);
    data.forEach(r => {
        console.log(`- ${r.timestamp} | Veh: ${r.vehicle_id} | L: ${r.liters} | Ext: ${r.is_external} | km: ${r.km} | ID: ${r.id}`);
    });
}

check();
