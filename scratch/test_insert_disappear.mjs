import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTriggers() {
    console.log('Checking triggers for fuel_transactions...');
    // pg_trigger query requires admin rights, which anon key doesn't have.
    // Instead, I'll just check if there's any RPC to get triggers.
    // Let's insert a test row right now using the exact payload "Registar Saida" uses!
    
    const payload = {
        id: "f0000000-0000-0000-0000-000000000000",
        vehicle_id: null,
        driver_id: 'manual',
        liters: 9.99,
        km: 9999,
        centro_custo_id: null,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        staff_id: 'admin',
        staff_name: 'Admin',
        // is_external is explicitly omitted to mimic the missing value in frontend payload
        pump_counter_after: 0
    };

    console.log("Inserting test row...");
    const { data, error } = await supabase.from('fuel_transactions').insert(payload).select();
    
    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("Insert success:", data);
        
        console.log("Immediately querying it back...");
        const { data: fetch1, error: fetchErr1 } = await supabase.from('fuel_transactions').select('*').eq('id', payload.id);
        console.log("Immediate fetch:", fetch1);
        
        console.log("Waiting 3 seconds...");
        await new Promise(r => setTimeout(r, 3000));
        
        console.log("Querying it back again...");
        const { data: fetch2 } = await supabase.from('fuel_transactions').select('*').eq('id', payload.id);
        console.log("Delayed fetch:", fetch2);
        
        console.log("Deleting test row...");
        await supabase.from('fuel_transactions').delete().eq('id', payload.id);
    }
}

checkTriggers();
