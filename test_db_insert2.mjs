import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const lines = envContent.split('\n');
let url = '';
let key = '';
for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function check() {
    const payload = {
        id: 'b0000000-0000-0000-0000-000000000000',
        driver_id: null,
        vehicle_id: '1cd9ac8a-7fc6-4ad7-a0a6-150059252ae1',
        liters: 10,
        km: 12345,
        staff_id: 'oficina',
        staff_name: 'Tablet Oficina',
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        is_external: false
    };
    
    const { data, error } = await supabase.from('fuel_transactions').insert(payload).select();
    console.log('DB ERROR:', error);
    console.log(data);
}

check();
