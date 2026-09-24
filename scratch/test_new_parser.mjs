import * as fs from 'fs';
import { parseBPInvoicePDF } from './new_parser_draft.js';

const pdfPath = 'C:/Users/mglma/.gemini/antigravity/brain/6525f70e-92c4-49f5-873e-d57f4c7b3af8/.user_uploaded/media__1785845046862.pdf';

async function run() {
    global.DOMMatrix = class DOMMatrix {};
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const txs = await parseBPInvoicePDF(data);
    
    console.log(`Total Extraído: ${txs.length} transações`);
    let sum = 0;
    for (const tx of txs) {
        sum += tx.Total;
    }
    console.log(`Soma dos Totais: ${sum.toFixed(2)} €`);
    
    fs.writeFileSync('scratch/test_new_parser_output.json', JSON.stringify(txs, null, 2));
}
run().catch(console.error);
