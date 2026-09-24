const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ptfgevdwcrwepkojrrnp.supabase.co';
const supabaseKey = 'sb_publishable_M0H58B0lOaESxkZpfFujZw_zbv7IaQF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getColumns() {
    const { data, error } = await supabase
        .from('fuel_transactions')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('No data');
        }
    }
}
getColumns();
