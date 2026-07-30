const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Combustivel', 'index.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Fix handleFileUpload
const oldCCMatch = "const matchedCC = centrosCustos.find(c => c.nome.toLowerCase() === ccName?.toLowerCase());";
const newCCMatch = "const ccNameStr = ccName ? String(ccName).trim().toLowerCase() : '';\n                const matchedCC = centrosCustos.find(c => c.nome.toLowerCase() === ccNameStr);";

content = content.replace(oldCCMatch, newCCMatch);

// 2. Add alert to handleConfirmBPImport catch block
const oldCatch = `            } catch (err) {
                console.error("Error importing row", row, err);
                errorCount++;
            }`;

const newCatch = `            } catch (err: any) {
                console.error("Error importing row", row, err);
                alert(\`Erro ao importar a linha da matrícula \${row['Matrícula'] || 'Desconhecida'}: \${err.message || 'Erro desconhecido'}\`);
                errorCount++;
            }`;

content = content.replace(oldCatch, newCatch);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Fixed handleFileUpload and catch block");
