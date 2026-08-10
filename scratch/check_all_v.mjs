import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAllV() {
    console.log("Checking all viaturas...");
    const { data: viaturas } = await supabase.from('viaturas').select('id, matricula');
    viaturas.filter(v => v.matricula.includes('AS')).forEach(v => console.log(v.matricula, v.id));
}

checkAllV();
