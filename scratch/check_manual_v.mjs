import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkManualV() {
    const { data: txs } = await supabase.from('fuel_transactions').select('vehicle_id').eq('is_external', false);
    const { data: viaturas } = await supabase.from('viaturas').select('id, matricula');
    
    const countByPlate = {};
    txs.forEach(t => {
        const v = viaturas.find(vi => vi.id === t.vehicle_id);
        const plate = v ? v.matricula : String(t.vehicle_id);
        countByPlate[plate] = (countByPlate[plate] || 0) + 1;
    });
    console.log("Manual transactions by vehicle plate:");
    console.log(countByPlate);
}

checkManualV();
