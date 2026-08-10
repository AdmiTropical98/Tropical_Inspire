const fs = require('fs');

let code = fs.readFileSync('src/contexts/WorkshopContext.tsx', 'utf8');

const target1 = `        // If explicitly confirmed AND NOT EXTERNAL, calculate tank updates immediately
        if (finalStatus === 'confirmed' && !transaction.isExternal) {
            const currentTotalizer = fuelTank.pumpTotalizer || 0;
            pumpCounterAfter = currentTotalizer + transaction.liters;
            const newLevel = Math.max(0, fuelTank.currentLevel - transaction.liters);

            // Update Tank immediately
            await updateFuelTank({
                ...fuelTank,
                currentLevel: newLevel,
                pumpTotalizer: pumpCounterAfter
            });
        }`;

const replace1 = `        // If explicitly confirmed AND NOT EXTERNAL, calculate tank updates
        let newLevel = fuelTank.currentLevel;
        if (finalStatus === 'confirmed' && !transaction.isExternal) {
            const currentTotalizer = fuelTank.pumpTotalizer || 0;
            pumpCounterAfter = currentTotalizer + transaction.liters;
            newLevel = Math.max(0, fuelTank.currentLevel - transaction.liters);
        }`;

const target2 = `        const { error: insertError } = await supabase.from('fuel_transactions').insert({
            id: transactionToSave.id,
            vehicle_id: isUuid(transactionToSave.vehicleId) ? transactionToSave.vehicleId : null,
            driver_id: transactionToSave.driverId,
            liters: transactionToSave.liters,`;

const replace2 = `        const { error: insertError } = await supabase.from('fuel_transactions').insert({
            id: transactionToSave.id,
            vehicle_id: isUuid(transactionToSave.vehicleId) ? transactionToSave.vehicleId : null,
            driver_id: isUuid(transactionToSave.driverId) ? transactionToSave.driverId : null,
            liters: transactionToSave.liters,`;

const target3 = `        if (insertError) {
            throw new Error(\`Erro na base de dados: \${insertError.message}\`);
        }`;

const replace3 = `        if (insertError) {
            throw new Error(\`Erro na base de dados: \${insertError.message}\`);
        }

        // Update Tank immediately AFTER successful insert
        if (finalStatus === 'confirmed' && !transaction.isExternal && pumpCounterAfter !== undefined) {
            await updateFuelTank({
                ...fuelTank,
                currentLevel: newLevel,
                pumpTotalizer: pumpCounterAfter
            });
        }`;

code = code.replace(target1, replace1);
code = code.replace(target2, replace2);
code = code.replace(target3, replace3);

fs.writeFileSync('src/contexts/WorkshopContext.tsx', code);
console.log("Patched successfully!");
