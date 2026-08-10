import * as fs from 'fs';
const ocr = fs.readFileSync('scratch/ocr_new.txt', 'utf-8');

const normalizeDashes = (val) => val.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
const parseEU = (val) => {
    if (!val) return 0;
    let s = normalizeDashes(val);
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};
const cleanNumberToken = (val) => val.trim().replace(/%/g, '') === '-' ? '0' : val.trim().replace(/%/g, '');
const isValidBPDate = (raw) => /^\d{6}$/.test(raw);
const bpDateToISO = (raw) => {
    if (/^\d{6}$/.test(raw)) {
        const day   = raw.slice(0, 2);
        const month = raw.slice(2, 4);
        const year  = '20' + raw.slice(4, 6);
        return `${year}-${month}-${day}`;
    }
    return raw;
};
const normalizeFuelToken = (val) => {
    const cleaned = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (cleaned.includes('ADBLUE')) return 'ADBLUE';
    return cleaned.replace(/[^A-Z0-9]/g, '');
};
const formatPlate = (val) => {
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 6) return val.toUpperCase();
    return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`;
};

function parseFromDateTalaoChunks(compact, invoiceRef) {
    const out = [];
    const normalized = compact
        .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
        .replace(/\bGAS\s+OLEO\b/gi, 'GASOLEO')
        .replace(/\bGAS\s+OIL\b/gi, 'GASOIL')
        .replace(/\bGASÓ\s*LEO\b/gi, 'GASOLEO')
        .replace(/\bGASO\s+LEO\b/gi, 'GASOLEO')
        .replace(/\s+/g, ' ')
        .trim();
    const anchorRe = /(\d{6})\s+(\d{6,14})\s+/g;
    const anchors = [...normalized.matchAll(anchorRe)].filter(m => isValidBPDate(m[1]));
    if (anchors.length === 0) return out;
    for (let i = 0; i < anchors.length; i++) {
        const m = anchors[i];
        const start = m.index ?? 0;
        const end = i + 1 < anchors.length ? (anchors[i + 1].index ?? normalized.length) : normalized.length;
        const chunk = normalized.slice(start, end).trim();
        const talao = m[2];
        const productMatch = chunk.match(/\b(GASOLEO\+?|GASÓLEO|GASOLEO|GASOLINA|DIESEL|ADBLUE|GPL|GNV|GASOIL)\b/i);
        if (!productMatch) continue;
        const productIdx = chunk.indexOf(productMatch[0]);
        if (productIdx < 0) continue;
        const beforeProduct = chunk.slice(0, productIdx).trim();
        const afterProduct = chunk.slice(productIdx + productMatch[0].length).trim();
        const plateMatch = chunk.match(/\b([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6})\b/i);
        const matricula = plateMatch ? formatPlate(plateMatch[1]) : 'N/D';

        const stopWords = /(TOTAL\s+DO\s+CART[ÃA]O|RESUMO\s+DO\s+IVA|TOTAL\s+FATURA|TOTAL\s+A\s+TRANSPORTAR|SUBTOTAL|TOTAL\s+GERAL|RESUMO\s+DE\s+PRODUTOS|P[ÁA]GINA)/i;
        const stopMatch = afterProduct.match(stopWords);
        const cleanAfterProduct = stopMatch ? afterProduct.slice(0, stopMatch.index) : afterProduct;
        const decimalTokens = (cleanAfterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || []).map(cleanNumberToken);
        if (decimalTokens.length < 2) continue;
        const total = parseEU(decimalTokens[decimalTokens.length - 1]);
        if (total <= 0) continue;
        let litros = parseEU(decimalTokens[0]);
        let unit = litros > 0 ? total / litros : 0;
        if (!(litros > 0 && litros <= 200 && unit >= 0.6 && unit <= 4.5)) {
            litros = 0;
            for (const t of decimalTokens.slice(0, Math.min(3, decimalTokens.length - 1))) {
                const v = parseEU(t);
                if (v <= 0 || v > 200) continue;
                unit = total / v;
                if (total > 0 && unit >= 0.6 && unit <= 4.5) {
                    litros = v;
                    break;
                }
            }
        }
        out.push({ _talao: talao, total: total, liters: litros, _manualDate: bpDateToISO(m[1]), matricula, chunk });
    }
    return out;
}

const rows = parseFromDateTalaoChunks(ocr, '123');
for (const r of rows) {
    if (r.matricula === '00-09-36') {
        console.log(r);
    }
}
