const fs = require('fs');

let code = fs.readFileSync('src/utils/parseBPInvoicePDF.ts', 'utf8');
code = code.replace(/import .*\n/g, '');
code = code.replace(/export async function parseBPInvoicePDF\(file: File\)/, 'async function parseBPInvoicePDF()');
code = code.replace(/const lines = await extractPdfLines\(file\);/, "const lines = fs.readFileSync('scratch/user_ocr.txt', 'utf8').split('\\n');");

code += `
const targetTalaos = ['02029977', '01018246', '01011527', '01017971', '01015855'];
parseBPInvoicePDF().then(res => {
    const tableData = res.map(r => ({
        Data: r.date || r._manualDate,
        Matricula: r['Matrícula'] || r.matricula || r.vehicle,
        Talao: (r._talao || r.talaoCupao || r.receipt || '').trim(),
        Litros: r['Litros'] || r.litros,
        'Valor Total': r['Total'] || r.total,
        rawText: (r.rawText || '').substring(0, 50),
        type: r.type || 'N/A'
    }));
    console.table(tableData);
    res.filter(r => targetTalaos.includes((r._talao || r.talaoCupao || r.receipt || '').trim())).forEach(r => console.log('COMPLETO:', r));
});
`;

fs.writeFileSync('scratch/run_parser.ts', code);
