import { parseBPInvoicePDF } from '../src/utils/parseBPInvoicePDF';
import * as fs from 'fs';

async function test() {
    const fileBuf = fs.readFileSync('brain/6525f70e-92c4-49f5-873e-d57f4c7b3af8/.user_uploaded/media__1785502376732.pdf');
    const file = new File([fileBuf], 'test.pdf', { type: 'application/pdf' });
    const result = await parseBPInvoicePDF(file);
    console.log(`Encontrados: ${result.transactions.length}`);
    const sum = result.transactions.reduce((acc, t) => acc + (t.Total || 0), 0);
    console.log(`Soma: ${sum.toFixed(2)}`);
    console.log(result.transactions.filter(t => String(t['Matrícula']) === '32-UT-37'));
}

test().catch(console.error);
