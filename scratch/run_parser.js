const fs = require('fs');

const ocr = fs.readFileSync('scratch/user_ocr.txt', 'utf8');

const PLATE_RE = /^[A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}$/i;
const PLATE_COMPACT_RE = /^[A-Z0-9]{6}$/i;

const normalizeDashes = (val) => val.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
const parseEU = (val) => {
    if (!val) return 0;
    let s = normalizeDashes(val);
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};
const cleanNumberToken = (val) => val.trim().replace(/%/g, '') === '-' ? '0' : val.trim().replace(/%/g, '');

const isValidBPDate = (raw) => {
    if (!/^\d{6}$/.test(raw)) return false;
    const day = parseInt(raw.slice(0, 2), 10);
    const month = parseInt(raw.slice(2, 4), 10);
    return day >= 1 && day <= 31 && month >= 1 && month <= 12;
};

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

function isValidParsedRow(row) {
    const talao = String(row._talao || '').trim();
    const plate = String(row['Matrícula'] || '').trim();
    const liters = Number(row['Litros'] || 0);
    const total = Number(row['Total'] || 0);
    const km = Number(row['Km'] || 0);
    const unit = liters > 0 ? total / liters : 0;

    if (!/^\d{6,14}$/.test(talao)) return false;
    if (!(PLATE_RE.test(plate) || PLATE_COMPACT_RE.test(plate.replace(/-/g, '')) || plate === 'OFICINA')) return false;
    if (!(liters > 0 && liters <= 400)) return false;
    if (!(total > 0 && total <= 5000)) return false;
    if (!(km >= 0 && km <= 10000000)) return false;
    if (!(unit >= 0.4 && unit <= 6.5)) return false;

    return true;
}

function parseFromCompactText(compact, invoiceRef) {
    const out = [];
    const cleanCompact = compact.replace(/(TOTAL\s+DO\s+CART|RESUMO\s+DO\s+IVA|TOTAL\s+FATURA|TOTAL\s+A\s+TRANSPORTAR|SUBTOTAL|TOTAL\s+GERAL|RESUMO\s+DE\s+PRODUTOS|P[ÁA]GINA)[\s\S]{0,80}?(\n|$)/gi, ' ');
    const rowRegex = /(\d{6})\s+(\d{6,14})\s+([A-Z0-9]{1,2}-[A-Z0-9]{1,2}-[A-Z0-9]{1,2}|[A-Z0-9-]{6,8}|OFICINA)\s+(.{3,80}?)\s+(\d{4,8})\s+(GASOLEO\+?|GASÓLEO|GASOLINA|DIESEL|ADBLUE-?\w*|ADBLUE|GPL|GNV)[\s\S]{0,40}?(\d{1,3}(?:\.\d{3})?,\d{2})[\s\S]{0,40}?(\d{1,3}(?:\.\d{3})?,\d{2})/gi;

    for (const m of cleanCompact.matchAll(rowRegex)) {
        const date = bpDateToISO(m[1]);
        const talao = m[2];
        const plate = formatPlate(m[3]);
        const posto = (m[4] || '').trim().replace(/\s{2,}/g, ' ');
        const km = parseEU(m[5]);
        const produto = normalizeFuelToken(m[6]);
        const litros = parseEU(m[7]);
        const total = parseEU(m[8]);

        if (!posto || litros <= 0 || total <= 0) continue;

        out.push({
            type: 'transaction',
            rawText: m[0],
            _manualDate: date,
            'Hora': '',
            'Matrícula': plate,
            'Km': km,
            'Posto': posto,
            'Produto': produto,
            'Litros': litros,
            'Preço Unitário': litros > 0 ? total / litros : 0,
            'Total': total,
            '_talao': talao,
            '_invoiceRef': invoiceRef,
            _selectedCC: '',
            _source: 'compact'
        });
    }
    return out;
}

function parseFromTransactionChunks(compact, invoiceRef) {
    const out = [];
    const normalized = compact
        .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
        .replace(/CARTÃO\s+N[º°]?\s+\d+/gi, ' ')
        .replace(/\bGAS\s+OLEO\b/gi, 'GASOLEO')
        .replace(/\bGAS\s+OIL\b/gi, 'GASOIL')
        .replace(/\bGASÓ\s*LEO\b/gi, 'GASOLEO')
        .replace(/\bGASO\s+LEO\b/gi, 'GASOLEO')
        .replace(/\s+/g, ' ')
        .trim();

    const rowStart = /(\d{6})\s+(\d{6,14})\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)\s+/gi;
    const starts = [...normalized.matchAll(rowStart)];
    if (starts.length === 0) return out;

    for (let i = 0; i < starts.length; i++) {
        const m = starts[i];
        const start = m.index ?? 0;
        const end = i + 1 < starts.length ? (starts[i + 1].index ?? normalized.length) : normalized.length;
        const chunk = normalized.slice(start, end).trim();

        const dateRaw = m[1];
        const talao = m[2];
        const plateRaw = m[3];

        const productMatch = chunk.match(/\b(GASOLEO\+?|GASÓLEO|GASOLEO|GASOLINA|DIESEL|ADBLUE-?\w*|ADBLUE|GPL|GNV|GASOIL)\b/i);
        if (!productMatch) continue;

        const product = normalizeFuelToken(productMatch[1]);
        const productIdx = chunk.indexOf(productMatch[0]);
        if (productIdx < 0) continue;

        const beforeProduct = chunk.slice(0, productIdx).trim();
        const afterProduct = chunk.slice(productIdx + productMatch[0].length).trim();

        const prefixTokens = beforeProduct.split(/\s+/).filter(Boolean);
        let km = 0;
        let kmPos = prefixTokens.length;
        for (let j = prefixTokens.length - 1; j >= 0; j--) {
            if (/^\d{4,8}$/.test(prefixTokens[j])) {
                km = parseEU(prefixTokens[j]);
                kmPos = j;
                break;
            }
        }

        const stationTokens = prefixTokens.slice(3, kmPos);
        const posto = stationTokens.join(' ').trim();
        if (!posto) continue;

        const stopWords = /(TOTAL\s+DO\s+CART|RESUMO\s+DO\s+IVA|TOTAL\s+FATURA|TOTAL\s+A\s+TRANSPORTAR|SUBTOTAL|TOTAL\s+GERAL|RESUMO\s+DE\s+PRODUTOS|P[ÁA]GINA)/i;
        const stopMatch = afterProduct.match(stopWords);
        const cleanAfterProduct = stopMatch ? afterProduct.slice(0, stopMatch.index) : afterProduct;

        const decimalTokens = (cleanAfterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || [])
            .map(cleanNumberToken)
            .filter(t => t.includes(','));
        if (decimalTokens.length < 2) continue;

        const total = parseEU(decimalTokens[decimalTokens.length - 1]);
        let litros = parseEU(decimalTokens[0]);
        let unitPrice = litros > 0 ? total / litros : 0;

        if (!(litros > 0 && litros <= 200 && total > 0 && unitPrice >= 0.6 && unitPrice <= 4.5)) {
            litros = 0;
            for (const t of decimalTokens.slice(0, Math.min(3, decimalTokens.length - 1))) {
                const v = parseEU(t);
                if (v <= 0 || v > 200) continue;
                unitPrice = total / v;
                if (total > 0 && unitPrice >= 0.6 && unitPrice <= 4.5) {
                    litros = v;
                    break;
                }
            }
        }
        if (litros <= 0 || total <= 0) continue;

        out.push({
            type: 'transaction',
            rawText: chunk.substring(0, 100),
            _manualDate: bpDateToISO(dateRaw),
            'Hora': '',
            'Matrícula': plateRaw === 'OFICINA' ? 'OFICINA' : formatPlate(plateRaw),
            'Km': km,
            'Posto': posto,
            'Produto': product,
            'Litros': litros,
            'Preço Unitário': total / litros,
            'Total': total,
            '_talao': talao,
            '_invoiceRef': invoiceRef,
            _selectedCC: '',
            _source: 'anchor'
        });
    }

    return out;
}

function parseFromDateTalaoChunks(compact, invoiceRef) {
    const out = [];
    const normalized = compact
        .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
        .replace(/CARTÃO\s+N[º°]?\s+\d+/gi, ' ')
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

        const date = bpDateToISO(m[1]);
        const talao = m[2];

        const productMatch = chunk.match(/\b(GASOLEO\+?|GASÓLEO|GASOLEO|GASOLINA|DIESEL|ADBLUE-?\w*|ADBLUE|GPL|GNV|GASOIL)\b/i);
        if (!productMatch) continue;
        const produto = normalizeFuelToken(productMatch[1]);

        const plateMatch = chunk.match(/\b([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)\b/i);
        const matricula = plateMatch ? (plateMatch[1].toUpperCase() === 'OFICINA' ? 'OFICINA' : formatPlate(plateMatch[1])) : 'N/D';

        const productIdx = chunk.indexOf(productMatch[0]);
        if (productIdx < 0) continue;
        const beforeProduct = chunk.slice(0, productIdx).trim();
        const afterProduct = chunk.slice(productIdx + productMatch[0].length).trim();

        const kmCandidates = [...beforeProduct.matchAll(/\b(\d{4,8})\b/g)]
            .map(v => v[1])
            .filter(v => !isValidBPDate(v) && v !== talao);
        const kmToken = kmCandidates.at(-1) ?? '0';
        const km = parseEU(kmToken);

        let posto = 'N/D';
        if (plateMatch && kmToken !== '0') {
            const platePos = beforeProduct.lastIndexOf(plateMatch[1]);
            const kmPos = beforeProduct.lastIndexOf(kmToken);
            if (platePos >= 0 && kmPos > platePos) {
                const p = beforeProduct.slice(platePos + plateMatch[1].length, kmPos).trim();
                if (p) posto = p.replace(/\s{2,}/g, ' ');
            }
        }

        const stopWords = /(TOTAL\s+DO\s+CART|RESUMO\s+DO\s+IVA|TOTAL\s+FATURA|TOTAL\s+A\s+TRANSPORTAR|SUBTOTAL|TOTAL\s+GERAL|RESUMO\s+DE\s+PRODUTOS|P[ÁA]GINA)/i;
        const stopMatch = afterProduct.match(stopWords);
        const cleanAfterProduct = stopMatch ? afterProduct.slice(0, stopMatch.index) : afterProduct;

        const decimalTokens = (cleanAfterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || [])
            .map(cleanNumberToken);
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

        out.push({
            type: 'transaction',
            rawText: chunk.substring(0, 100),
            _manualDate: date,
            'Hora': '',
            'Matrícula': matricula,
            'Km': km,
            'Posto': posto,
            'Produto': produto,
            'Litros': litros,
            'Preço Unitário': litros > 0 ? total / litros : 0,
            'Total': total,
            '_talao': talao,
            '_invoiceRef': invoiceRef,
            _selectedCC: '',
            _source: 'datetalao'
        });
    }

    return out;
}

const dedupePreviewRows = (rows) => {
    const grouped = new Map();

    const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
    const isPlateLike = (v) => /^([A-Z0-9]{1,3}-){2}[A-Z0-9]{1,3}$/.test(v);

    const scoreRow = (row) => {
        const litros = Number(row['Litros'] || 0);
        const total = Number(row['Total'] || 0);
        const unit = litros > 0 ? total / litros : 0;
        const date = String(row._manualDate || '');
        const plate = String(row['Matrícula'] || '').toUpperCase();
        const posto = String(row['Posto'] || '').trim().toUpperCase();
        const km = Number(row['Km'] || 0);

        let s = 0;
        if (isIsoDate(date)) s += 8;
        if (isPlateLike(plate)) s += 5;
        if (posto && posto !== 'N/D') s += 3;
        if (km > 0 && km <= 3000000) s += 2;

        if (litros > 0 && litros <= 120) s += 12;
        else if (litros > 120 && litros <= 200) s += 4;
        else s -= 20;

        if (unit >= 0.75 && unit <= 3.2) s += 12;
        else if (unit >= 0.6 && unit <= 4.5) s += 4;
        else s -= 20;

        if (total > 0 && total <= 1000) s += 5;
        else if (total <= 0) s -= 20;

        const talao = String(row._talao || '').trim();
        if (/^\d{6,14}$/.test(talao)) s += 5;

        const source = String(row._source || '');
        if (source === 'canonical') s += 50;
        else if (source === 'regex') s += 30;
        else if (source === 'anchor') s += 20;
        else if (source === 'card') s += 10;

        return s;
    };

    for (const row of rows) {
        const talao = String(row._talao || '').trim();
        const key = [
            talao || '',
            row._manualDate || '',
            String(row['Matrícula'] || '').toUpperCase(),
            Number(row['Km'] || 0).toFixed(0),
            Number(row['Litros'] || 0).toFixed(2),
            Number(row['Total'] || 0).toFixed(2)
        ].join('|');

        if (!grouped.has(key)) {
            grouped.set(key, row);
        } else {
            const existing = grouped.get(key);
            if (scoreRow(row) > scoreRow(existing)) {
                grouped.set(key, row);
            }
        }
    }

    const uniqueRows = Array.from(grouped.values()).filter(row => {
        const litros = Number(row['Litros'] || 0);
        const total = Number(row['Total'] || 0);
        const posto = String(row['Posto'] || '').toUpperCase();
        if (litros <= 0 || total <= 0) return false;
        if (posto.includes('TOTAL DO CART')) return false;
        return true;
    });

    const byTalao = new Map();
    for (const r of uniqueRows) {
        const k = r._talao;
        if (!byTalao.has(k) || scoreRow(r) > scoreRow(byTalao.get(k))) {
            byTalao.set(k, r);
        }
    }

    return Array.from(byTalao.values()).sort((a, b) => (a._manualDate || '').localeCompare(b._manualDate || ''));
};

let all = [];
all.push(...parseFromCompactText(ocr, '123').filter(isValidParsedRow));
all.push(...parseFromTransactionChunks(ocr, '123').filter(isValidParsedRow));
all.push(...parseFromDateTalaoChunks(ocr, '123').filter(isValidParsedRow));

const res = dedupePreviewRows(all);

const targetTalaos = ['02029977', '01018246', '01011527', '01017971', '01015855'];
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

