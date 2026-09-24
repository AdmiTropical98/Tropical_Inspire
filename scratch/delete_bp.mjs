import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function deleteBP() {
    console.log("Deleting all BP imports...");
    
    // First, count how many there are
    const { count: countBefore } = await supabase.from('fuel_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_external', true);
        
    console.log(`Found ${countBefore} BP transactions to delete.`);
    
    if (countBefore > 0) {
        // Since delete might have a limit, let's delete them in batches or just run a delete query
        const { error, count: deletedCount } = await supabase.from('fuel_transactions')
            .delete()
            .eq('is_external', true);
            
        if (error) {
            console.error("Error deleting:", error);
        } else {
            console.log("Deletion successful.");
        }
    }
    
    // Verify
    const { count: countAfter } = await supabase.from('fuel_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_external', true);
        
    console.log(`BP transactions remaining: ${countAfter}`);
}
deleteBP();
