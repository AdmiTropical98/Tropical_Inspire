const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Combustivel', 'index.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /<h3 className="font-bold text-slate-900 text-xl">Pré-visualização \(\{bpTransactions\.length\} registos\)<\/h3>\s*<p className="text-\[11px\] text-slate-500">Registos encontrados: \{bpTransactions\.length\}<\/p>/m;

const replacement = `<h3 className="font-bold text-slate-900 text-xl">Pré-visualização ({bpTransactions.length} registos)</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <p className="text-[12px] text-slate-500">Encontrados: {bpTransactions.length}</p>
                                                <div className="h-3 w-[1px] bg-slate-300"></div>
                                                <p className="text-[12px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                                                    Total do Ficheiro: {bpTransactions.reduce((sum, row) => sum + parseImportNumber(row['Litros']), 0).toFixed(2)} L | {bpTransactions.reduce((sum, row) => sum + parseImportNumber(row['Total']), 0).toFixed(2)} €
                                                </p>
                                            </div>`;

if (!regex.test(content)) {
    console.error("No match");
    process.exit(1);
}

content = content.replace(regex, replacement);
fs.writeFileSync(filePath, content, 'utf-8');
console.log("Updated successfully");
