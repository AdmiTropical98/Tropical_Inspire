import * as fs from 'fs';

const ocr = fs.readFileSync('C:\\Users\\mglma\\.gemini\\antigravity\\brain\\6525f70e-92c4-49f5-873e-d57f4c7b3af8\\ocr.txt', 'utf-8');

const normalizeDashes = (val) => val.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
const parseEU = (val) => {
    if (!val) return 0;
    let s = normalizeDashes(val);
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};
const cleanNumberToken = (val) => val.trim().replace(/%/g, '') === '-' ? '0' : val.trim().replace(/%/g, '');

const compact = ocr;
const normalized = compact
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
    .replace(/\bGAS\s+OLEO\b/gi, 'GASOLEO')
    .replace(/\s+/g, ' ')
    .trim();

const rowStart = /(\d{6})\s+(\d{6,14})\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3})\s+/gi;
const starts = [...normalized.matchAll(rowStart)];

const out = [];
for (let i = 0; i < starts.length; i++) {
    const m = starts[i];
    const start = m.index;
    const end = i + 1 < starts.length ? starts[i + 1].index : normalized.length;
    const chunk = normalized.slice(start, end).trim();

    const productMatch = chunk.match(/\b(GASOLEO\+?|GASÓLEO|GASOLEO|GASOLINA|DIESEL|ADBLUE|GPL|GNV|GASOIL|Ult Diesel|ADBLUE-B|ADBLUE-C)\b/i);
    if (!productMatch) continue;

    const afterProduct = chunk.slice(chunk.indexOf(productMatch[0]) + productMatch[0].length).trim();
    // I am changing the chunk slice to 120 which is what parseFromTransactionChunks does!
    const decimalTokens = (afterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || []).map(cleanNumberToken).filter(t => t.includes(','));
    
    if (decimalTokens.length >= 2) {
        out.push({
            plate: m[3],
            liters: parseEU(decimalTokens[0]),
            total: parseEU(decimalTokens[decimalTokens.length - 1]),
            decimals: decimalTokens,
            chunkText: afterProduct.slice(0, 120)
        });
    }
}
console.log(out);
