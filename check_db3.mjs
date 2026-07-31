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
    // try fetching based on creation logic or just search for anything where is_external is false that is not the one from 2026-07-30
    const { data, error } = await supabase.from('fuel_transactions').select('*').eq('is_external', false).order('timestamp', { ascending: false }).limit(20);
    console.log("DB ERROR:", error);
    data.forEach(d => console.log(d.timestamp, d.liters, d.is_external, d.status, d.staff_name));
}

check();
