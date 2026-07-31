const fs = require('fs');

const content = fs.readFileSync('src/utils/parseBPInvoicePDF.ts', 'utf8');

let newContent = content.replace(
    /const BP_TRANSACTION_LINE_RE = .*$/m,
    `const BP_TRANSACTION_LINE_RE = /^(\\d{6})\\s+(\\d{6,14})\\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)\\s+(.+?)\\s+(?:(\\d{4,8})\\s+)?(GASOLEO\\+?|GASÓLEO|GASOLEO|DIESEL|ULTIMATE|ULT\\s+DIESEL|ULT\\s*DIESEL|ULT|GASOLINA|ADBLUE-?\\w*|ADBLUE|GPL|GNV|GASOIL)\\s+((?:-?\\d{1,3}(?:\\.\\d{3})?,\\d+\\*?\\s*){4,8})$/i;`
);

// We need to change how the regex is matched in the code.
// Instead of fixed groups, we match the rest of the line (all numbers) and split them.

fs.writeFileSync('scratch/fix_parser.js', `
const fs = require('fs');
let code = fs.readFileSync('src/utils/parseBPInvoicePDF.ts', 'utf8');

code = code.replace(
    /const BP_TRANSACTION_LINE_RE = .*/,
    "const BP_TRANSACTION_LINE_RE = /^(\\\\d{6})\\\\s+(\\\\d{6,14})\\\\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)\\\\s+(.+?)\\\\s+(?:(\\\\d{1,8})\\\\s+)?(GASOLEO\\\\+?|GASÓLEO|GASOLEO|DIESEL|ULTIMATE|ULT\\\\s+DIESEL|ULT\\\\s*DIESEL|ULT|GASOLINA|ADBLUE-?\\\\w*|ADBLUE|GPL|GNV|GASOIL)\\\\s+((?:-?\\\\d{1,3}(?:\\\\.\\\\d{3})?,\\\\d+\\\\*?\\\\s*){4,8})$/i;"
);

// Remove the 7COL regex, we don't need it if we split the numbers dynamically.
code = code.replace(/const BP_TRANSACTION_LINE_RE_7COL = .*;\\n/g, '');

// Now we need to modify the match logic in the parse loop
const matchLogic = \`
                let match = line.match(BP_TRANSACTION_LINE_RE);
                if (match) {
                    const [, dateStr, talao, matricula, postoRaw, kmStr, produto, numbersStr] = match;
                    const posto = postoRaw.trim();
                    const km = kmStr ? parseInt(kmStr, 10) : 0;
                    
                    const numTokens = numbersStr.trim().split(/\\s+/).map(s => s.replace('*', ''));
                    
                    let litros = 0, precoLista = 0, desconto = 0, precoUnitario = 0, ivaPercent = 23, valorLiquido = 0, ivaValue = 0, total = 0;
                    
                    if (numTokens.length === 8) {
                        litros = parseEU(numTokens[0]);
                        precoLista = parseEU(numTokens[1]);
                        desconto = parseEU(numTokens[2]);
                        precoUnitario = parseEU(numTokens[3]);
                        ivaPercent = parseEU(numTokens[4]);
                        valorLiquido = parseEU(numTokens[5]);
                        ivaValue = parseEU(numTokens[6]);
                        total = parseEU(numTokens[7]);
                    } else if (numTokens.length === 7) {
                        litros = parseEU(numTokens[0]);
                        precoLista = parseEU(numTokens[1]);
                        precoUnitario = parseEU(numTokens[2]);
                        ivaPercent = parseEU(numTokens[3]);
                        valorLiquido = parseEU(numTokens[4]);
                        ivaValue = parseEU(numTokens[5]);
                        total = parseEU(numTokens[6]);
                    } else if (numTokens.length === 4) {
                        litros = parseEU(numTokens[0]);
                        valorLiquido = parseEU(numTokens[1]);
                        ivaValue = parseEU(numTokens[2]);
                        total = parseEU(numTokens[3]);
                    }

                    // For the date (DDMMYY)
                    const day = dateStr.slice(0, 2);
                    const month = dateStr.slice(2, 4);
                    const year = '20' + dateStr.slice(4, 6);
                    const isoDate = \\\`\${year}-\${month}-\${day}\\\`;

                    transactions.push({
                        date: isoDate,
                        talaoCupao: talao,
                        matricula,
                        posto,
                        km,
                        produto,
                        litros,
                        precoLista,
                        desconto,
                        precoUnitario,
                        ivaPercent,
                        valorLiquido,
                        ivaValue,
                        total,
                        invoiceRef
                    });
                    continue;
                }
\`;

code = code.replace(/let match = line\\.match\\(BP_TRANSACTION_LINE_RE\\);[\\s\\S]*?continue;\\n                \\}/, matchLogic.trim());

// Also remove the else if for 7COL
code = code.replace(/else if \\(match7\\) \\{[\\s\\S]*?continue;\\n                \\}/, '');
code = code.replace(/let match7 = line\\.match\\(BP_TRANSACTION_LINE_RE_7COL\\);/, '');

fs.writeFileSync('src/utils/parseBPInvoicePDF.ts', code);
console.log('Parser updated!');
`);
