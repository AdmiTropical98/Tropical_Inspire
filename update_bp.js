const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Combustivel', 'index.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace parseImportNumber
const oldParseRegex = /    const parseImportNumber = \(\w+: any\): number => \{[\s\S]*?return 0;\s*\};/m;

const newParse = `    const parseImportNumber = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let normalized = val.trim().replace(/\\s/g, '').replace('€', '').replace('L', '').replace('l', '');
            
            const lastComma = normalized.lastIndexOf(',');
            const lastDot = normalized.lastIndexOf('.');
            
            if (lastComma > lastDot) {
                normalized = normalized.replace(/\\./g, '').replace(',', '.');
            } else if (lastDot > lastComma) {
                normalized = normalized.replace(/,/g, '');
            } else if (lastComma > -1) {
                normalized = normalized.replace(',', '.');
            }

            const num = parseFloat(normalized);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };`;

content = content.replace(oldParseRegex, newParse);

// 2. Replace handleConfirmBPImport confirmation
const oldConfirmStr = 'if (!confirm(`Confirma a importação de ${rowsToImport.length} registos selecionados?`)) return;';
const newConfirmStr = `        const totalLitersToImport = rowsToImport.reduce((sum, row) => sum + parseImportNumber(row['Litros']), 0);
        const totalCostToImport = rowsToImport.reduce((sum, row) => sum + parseImportNumber(row['Total']), 0);

        if (!confirm(\`Confirma a importação de \${rowsToImport.length} registos selecionados?\\n\\nResumo:\\nTotal Litros: \${totalLitersToImport.toFixed(2)} L\\nCusto Total: \${totalCostToImport.toFixed(2)} €\`)) return;`;

content = content.replace(oldConfirmStr, newConfirmStr);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Successfully updated parseImportNumber and handleConfirmBPImport");
