const fs = require('fs');

let code = fs.readFileSync('src/contexts/WorkshopContext.tsx', 'utf8');

const targetStr = `        const { error: insertError } = await supabase.from('fuel_transactions').insert({
            id: transactionToSave.id,
            vehicle_id: isUuid(transactionToSave.vehicleId) ? transactionToSave.vehicleId : null,
            driver_id: transactionToSave.driverId,
            liters: transactionToSave.liters,`;

const replaceStr = `        const { error: insertError } = await supabase.from('fuel_transactions').insert({
            id: transactionToSave.id,
            vehicle_id: isUuid(transactionToSave.vehicleId) ? transactionToSave.vehicleId : null,
            driver_id: isUuid(transactionToSave.driverId) ? transactionToSave.driverId : null,
            liters: transactionToSave.liters,`;

if (!code.includes(targetStr)) {
    console.log("Could not find the target string!");
} else {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('src/contexts/WorkshopContext.tsx', code);
    console.log("Patched successfully!");
}
