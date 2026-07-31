import { parseBPInvoicePDF } from './src/utils/parseBPInvoicePDF.ts';
import fs from 'fs';

async function test() {
    const fileBuf = fs.readFileSync('.user_uploaded/media__1785502376732.pdf');
    const file = new File([fileBuf], 'test.pdf', { type: 'application/pdf' });
    const result = await parseBPInvoicePDF(file);
    console.log(`Found ${result.length} transactions.`);
    let totalLiters = 0;
    let totalCost = 0;
    for (const tx of result) {
        totalLiters += parseFloat(tx['Litros']);
        totalCost += parseFloat(tx['Total']);
    }
    console.log(`Total Litros: ${totalLiters.toFixed(2)}, Total Cost: ${totalCost.toFixed(2)}`);
}

test();
