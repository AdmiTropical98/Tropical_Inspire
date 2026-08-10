import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkVehicle() {
    console.log("Checking AS-70-BF...");
    const { data: viatura } = await supabase.from('viaturas').select('*').ilike('matricula', '%AS-70-BF%').single();
    if (!viatura) {
        console.log("Viatura not found");
        return;
    }
    console.log("Viatura:", viatura.id, viatura.matricula);

    const { data: txs } = await supabase.from('fuel_transactions').select('*').eq('vehicle_id', viatura.id);
    console.log(`Found ${txs.length} transactions for this vehicle.`);
    if (txs.length > 0) {
        console.log(txs.map(t => ({ d: t.timestamp, km: t.km, l: t.liters, ext: t.is_external })));
    }
}

checkVehicle();
