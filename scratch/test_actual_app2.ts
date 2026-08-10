import { extractTextFromPDF, parseBPInvoicePDF } from '../src/utils/parseBPInvoicePDF';
import * as fs from 'fs';

async function test() {
    // We will use the OCR text provided by the user in the prompt.
    // Actually, I can just use the parseBPInvoicePDF directly if I save it to a file.
    
    const fileBuf = fs.readFileSync('brain/6525f70e-92c4-49f5-873e-d57f4c7b3af8/.user_uploaded/media__1785776402760.pdf');
    const file = new File([fileBuf], 'test.pdf', { type: 'application/pdf' });
    const result = await parseBPInvoicePDF(file);
    console.log(`Encontrados: ${result.transactions.length}`);
    const sum = result.transactions.reduce((acc, t) => acc + (t.Total || 0), 0);
    console.log(`Soma: ${sum.toFixed(2)}`);
    console.log("Transactions with high totals:");
    result.transactions.filter(t => t.Total > 150).forEach(t => console.log(t));
}

test().catch(console.error);
