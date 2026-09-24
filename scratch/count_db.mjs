import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function countRecords() {
    console.log("Counting all transactions...");
    const { count: total, error: err1 } = await supabase.from('fuel_transactions').select('*', { count: 'exact', head: true });
    console.log("Total:", total, err1);

    console.log("Counting external (BP) transactions...");
    const { count: ext, error: err2 } = await supabase.from('fuel_transactions').select('*', { count: 'exact', head: true }).eq('is_external', true);
    console.log("External:", ext, err2);

    console.log("Counting manual transactions...");
    const { count: man, error: err3 } = await supabase.from('fuel_transactions').select('*', { count: 'exact', head: true }).is('is_external', false);
    console.log("Manual (is_external = false):", man, err3);

    console.log("Counting manual transactions (is_external IS NULL)...");
    const { count: nul, error: err4 } = await supabase.from('fuel_transactions').select('*', { count: 'exact', head: true }).is('is_external', null);
    console.log("Manual (is_external IS NULL):", nul, err4);
}

countRecords();
