const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ptfgevdwcrwepkojrrnp.supabase.co';
const supabaseKey = 'sb_publishable_M0H58B0lOaESxkZpfFujZw_zbv7IaQF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.rpc('get_table_columns_info'); // Assuming this exists, or we can just fetch one row
    if (error) {
        // Fallback: Just fetch a row and look at the keys
        const { data: rows, error: rowsError } = await supabase.from('fuel_transactions').select('*').limit(1);
        if (rows && rows.length > 0) {
            console.log(Object.keys(rows[0]));
        } else {
             console.log("No data, attempting insert with fake column to see error:");
             const { error: insErr } = await supabase.from('fuel_transactions').insert({ _fake: 1 });
             console.log(insErr);
        }
    } else {
        console.log(data);
    }
}
checkColumns();
