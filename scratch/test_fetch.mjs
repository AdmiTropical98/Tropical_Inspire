import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkFetch() {
    const { data: transData, error } = await supabase.from('fuel_transactions').select('*').order('timestamp', { ascending: false }).limit(2000);
    
    if (error) {
        console.error("Error:", error);
        return;
    }

    let manualCount = 0;
    let externalCount = 0;

    transData.forEach(t => {
        if (t.is_external === false || t.is_external === null) {
            manualCount++;
        } else {
            externalCount++;
        }
    });

    console.log(`Fetched total: ${transData.length}`);
    console.log(`Fetched manual: ${manualCount}`);
    console.log(`Fetched external: ${externalCount}`);
    
    if (manualCount > 0) {
        const firstManual = transData.find(t => t.is_external === false || t.is_external === null);
        console.log(`First manual entry date: ${firstManual.timestamp}`);
    }
}

checkFetch();
