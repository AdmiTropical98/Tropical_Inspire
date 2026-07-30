const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ptfgevdwcrwepkojrrnp.supabase.co';
const supabaseKey = 'sb_publishable_M0H58B0lOaESxkZpfFujZw_zbv7IaQF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteExternal() {
    const { data, error } = await supabase
        .from('fuel_transactions')
        .delete()
        .eq('is_external', true);
        
    if (error) {
        console.error('Error deleting:', error);
    } else {
        console.log('Successfully deleted external BP imports');
    }
}
deleteExternal();
