import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkManuals() {
    console.log("Fetching all manual transactions...");
    const { data, error } = await supabase
        .from('fuel_transactions')
        .select('*')
        .eq('is_external', false)
        .order('timestamp', { ascending: false });
    
    if (error) {
        console.error("DB error:", error);
        return;
    }
    
    console.log("Total manuals:", data.length);
    if (data.length > 0) {
        console.log("Most recent 5 manual dates:");
        data.slice(0, 5).forEach(r => console.log(r.timestamp, r.driver_id, r.vehicle_id));
        console.log("Oldest 5 manual dates:");
        data.slice(-5).forEach(r => console.log(r.timestamp, r.driver_id, r.vehicle_id));
        
        // Let's count by month for 2026
        const months = {};
        data.forEach(r => {
            const m = r.timestamp ? r.timestamp.slice(0, 7) : 'none';
            months[m] = (months[m] || 0) + 1;
        });
        console.log("Manuals per month:");
        console.log(months);
    }
}

checkManuals();
