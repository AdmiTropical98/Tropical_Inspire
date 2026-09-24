import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Supabase Connection String
// postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

// If we only have VITE_SUPABASE_URL and KEY, we cannot use pg directly unless we know the db string.
// Let's use the REST API to get the latest row inserted by querying the highest ID if it's sequential? No, it's UUID.
// Let's just query everything and filter in JS to see if ANY transaction has today's date in `timestamp` or anything weird.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTxs() {
    // Fetch top 50 inserted, but since we can't order by insert time, let's just fetch all and find the ones where staff_name == 'Miguel Madeira' or timestamp > '2026-07-28'
    const { data, error } = await supabase
        .from('fuel_transactions')
        .select('*');
        
    if (error) console.error(error);
    else {
        // Since we don't have created_at, just print the last 5 in the array 
        // Note: the order is not guaranteed, but let's just print them
        console.log("Total txs:", data.length);
        console.log(JSON.stringify(data.slice(-5), null, 2));
    }
}

checkTxs();
