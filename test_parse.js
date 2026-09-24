const bpTransactions = [
    { Litros: '1.234,56', Total: '4.567,89' },
    { Litros: 50, Total: 100 },
    { Litros: '1234.56', Total: '1234.56' },
    { missing: true }
];

const parseImportNumber = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let normalized = val.trim().replace(/\s/g, '').replace('€', '').replace('L', '').replace('l', '');
        
        const lastComma = normalized.lastIndexOf(',');
        const lastDot = normalized.lastIndexOf('.');
        
        if (lastComma > lastDot) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else if (lastDot > lastComma) {
            normalized = normalized.replace(/,/g, '');
        } else if (lastComma > -1) {
            normalized = normalized.replace(',', '.');
        }

        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

const rowsToImport = bpTransactions;
const totalLitersToImport = rowsToImport.reduce((sum, row) => sum + parseImportNumber(row['Litros']), 0);
const totalCostToImport = rowsToImport.reduce((sum, row) => sum + parseImportNumber(row['Total']), 0);

console.log(`Confirma a importação de ${rowsToImport.length} registos selecionados?\n\nResumo:\nTotal Litros: ${totalLitersToImport.toFixed(2)} L\nCusto Total: ${totalCostToImport.toFixed(2)} €`);
