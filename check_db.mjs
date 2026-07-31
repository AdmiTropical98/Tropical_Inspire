import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/mglma/.gemini/antigravity/scratch/gestao_oficina/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');
let url = '';
let key = '';
for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('fuel_transactions').select('*').order('timestamp', { ascending: false }).limit(5);
    console.log("DB ERROR:", error);
    console.log("DATA:", JSON.stringify(data, null, 2));
}

check();
