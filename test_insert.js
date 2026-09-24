const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ptfgevdwcrwepkojrrnp.supabase.co';
const supabaseKey = 'sb_publishable_M0H58B0lOaESxkZpfFujZw_zbv7IaQF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    const { data, error } = await supabase
        .from('fuel_transactions')
        .insert({
            id: '123e4567-e89b-12d3-a456-426614174000',
            vehicle_id: null,
            liters: 0,
            km: 0,
            status: 'confirmed',
            timestamp: new Date().toISOString(),
            is_external: true
        });
        
    console.log('Error:', error);
}
testInsert();
