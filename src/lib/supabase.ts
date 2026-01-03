
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ptfgevdwcrwepkojrrnp.supabase.co';
const supabaseKey = 'sb_publishable_M0H58B0lOaESxkZpfFujZw_zbv7IaQF'; // User provided key

export const supabase = createClient(supabaseUrl, supabaseKey);
