import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
    const tx = {
        id: crypto.randomUUID(),
        driver_id: null,
        vehicle_id: '1cd9ac8a-7fc6-4ad7-a0a6-150059252ae1',
        liters: 10,
        km: 12345,
        staff_id: '252eb4b6-16fb-4015-822a-f828c73a6d3e',
        staff_name: 'Test',
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        is_external: false,
    };
    
    console.log("Inserting:", tx);
    const { data, error } = await supabase.from('fuel_transactions').insert(tx);
    console.log("Error:", error);
    console.log("Data:", data);
}

testInsert();
