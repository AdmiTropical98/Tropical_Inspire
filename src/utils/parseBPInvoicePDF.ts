/**
 * BP Mobility Fuel Invoice PDF Parser
 *
 * Parses the "Fatura" PDF issued by BP Mobility (e.g. B2Mobility GmbH)
 * and extracts individual fuel transactions.
 *
 * Invoice column layout (after extracting text by Y/X position):
 *   Data | Talão | Condutor | Posto / Local | Km | Produto | Quant. | Lista | Efet. | Unitário | IVA | Líq/IVA | IVA | Total
 *
 * Date format in invoice: DDMMYY  (e.g. 020226 → 2026-02-02)
 * Number format: European (comma decimal separator, e.g. 67,18)
 */

import * as pdfjsLib from 'pdfjs-dist';

// Reuse the same CDN worker setup as the existing pdfParser utility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/** One fuel transaction extracted from the BP invoice */
export interface BPInvoiceTransaction {
    /** ISO date string YYYY-MM-DD */
    date: string;
    /** Talão / voucher number */
    talaoCupao: string;
    /** Vehicle plate / condutor identifier  e.g. "56-VD-25" */
    matricula: string;
    /** Fuel station / location */
    posto: string;
    /** Odometer reading (km) */
    km: number;
    /** Fuel product, e.g. "GASOLEO" */
    produto: string;
    /** Liters dispensed */
    litros: number;
    /** List price per litre */
    precoLista: number;
    /** Discount per litre (usually negative) */
    desconto: number;
    /** Effective unit price (= listPrice + discount) */
    precoUnitario: number;
    /** IVA percentage (e.g. 23) */
    ivaPercent: number;
    /** Net value (excluding IVA) */
    valorLiquido: number;
    /** IVA amount */
    ivaValue: number;
    /** Invoice total (net + IVA) */
    total: number;
    /** Invoice reference extracted from the document header */
    invoiceRef: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Known BP fuel product keywords */
const FUEL_PRODUCT_RE = /(GASOLEO|GASÓLEO|GASOLINA|DIESEL|GNV|G\.N\.V\.?|BIODIESEL|ADBLUE|GPL|SUPER|GASOIL)/i;

/** BP PDFs may include non-standard segmented identifiers like 4U-R-60 */
const PLATE_RE = /^[A-Z0-9]{1,2}-[A-Z0-9]{1,2}-[A-Z0-9]{1,2}$/i;
const PLATE_COMPACT_RE = /^[A-Z0-9]{6}$/i;

const DATE_TOKEN_RE = /^(\d{6}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})$/;
const NUMERIC_TOKEN_RE = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/;

/** Parse European-format number string → JS number */
const parseEU = (val: string): number => {
    if (!val) return 0;
    // "1.719" (thousands dot) or "1,719" (decimal comma)?
    // In BP invoices: dot is thousands separator, comma is decimal.
    // Strategy: if comma exists treat dots as thousands and comma as decimal.
    let s = val.trim();
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

/** Convert BP date to ISO YYYY-MM-DD */
const bpDateToISO = (raw: string): string => {
    if (/^\d{6}$/.test(raw)) {
        const day   = raw.slice(0, 2);
        const month = raw.slice(2, 4);
        const year  = '20' + raw.slice(4, 6);
        return `${year}-${month}-${day}`;
    }

    const slashMatch = raw.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})$/);
    if (slashMatch) {
        const day = slashMatch[1];
        const month = slashMatch[2];
        const yy = slashMatch[3];
        const year = yy.length === 2 ? `20${yy}` : yy;
        return `${year}-${month}-${day}`;
    }

    return raw;
};

/** Validate that a 6-digit token is a plausible DDMMYY date (not a KM or other number) */
const isValidBPDate = (token: string): boolean => {
    if (!/^\d{6}$/.test(token)) return false;
    const dd = parseInt(token.slice(0, 2), 10);
    const mm = parseInt(token.slice(2, 4), 10);
    const yy = parseInt(token.slice(4, 6), 10);
    return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 20 && yy <= 35;
};

const cleanNumberToken = (val: string): string => {
    const trimmed = val.trim().replace(/%/g, '');
    if (trimmed === '-') return '0';
    return trimmed;
};

const normalizeFuelToken = (val: string): string => {
    return val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
};

const isFuelToken = (val: string): boolean => {
    const direct = FUEL_PRODUCT_RE.test(val);
    if (direct) return true;

    const n = normalizeFuelToken(val);
    return (
        n.includes('GASOLEO')
        || n.includes('GASOLINA')
        || n.includes('DIESEL')
        || n.includes('ADBLUE')
        || n.includes('GPL')
        || n.includes('GNV')
        || n.includes('GASOIL')
    );
};

const formatPlate = (val: string): string => {
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 6) return val.toUpperCase();
    return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`;
};

const normalizeLineTokens = (tokens: string[]): string[] => {
    const normalized: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i]?.trim();
        const next = tokens[i + 1]?.trim();
        if (!current) continue;

        const joined = `${current}${next || ''}`.toUpperCase();
        if (next && ['GASOLEO', 'GASOIL', 'GASOLINA', 'ADBLUE'].includes(joined)) {
            normalized.push(joined);
            i += 1;
            continue;
        }

        normalized.push(current);
    }

    return mergeNegatives(normalized);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPreviewRow = (tx: BPInvoiceTransaction): any => ({
    _manualDate: tx.date,
    'Hora': '',
    'Matrícula': tx.matricula,
    'Km': tx.km,
    'Posto': tx.posto,
    'Produto': tx.produto,
    'Litros': tx.litros,
    'Preço Unitário': tx.precoUnitario,
    'Total': tx.total,
    '_talao': tx.talaoCupao,
    '_ivaPercent': tx.ivaPercent,
    '_ivaValue': tx.ivaValue,
    '_valorLiquido': tx.valorLiquido,
    '_invoiceRef': tx.invoiceRef,
    _selectedCC: '',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dedupePreviewRows = (rows: any[]): any[] => {
    const grouped = new Map<string, any[]>();

    const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);
    const isPlateLike = (v: string): boolean => /^([A-Z0-9]{1,3}-){2}[A-Z0-9]{1,3}$/.test(v);

    const scoreRow = (row: any): number => {
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

        return s;
    };

    for (const row of rows) {
        const talao = String(row._talao || '').trim();
        const key = talao
            ? `talao:${talao}`
            : [
                row._manualDate || '',
                String(row['Matrícula'] || '').toUpperCase(),
                Number(row['Litros'] || 0).toFixed(2),
                Number(row['Total'] || 0).toFixed(2),
            ].join('|');

        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
    }

    const resolved: any[] = [];
    for (const candidates of grouped.values()) {
        let best = candidates[0];
        let bestScore = scoreRow(best);
        for (let i = 1; i < candidates.length; i++) {
            const s = scoreRow(candidates[i]);
            if (s > bestScore) {
                best = candidates[i];
                bestScore = s;
            }
        }
        resolved.push(best);
    }

    return resolved;
};

// ─── main ─────────────────────────────────────────────────────────────────────

/**
 * Extract all text items from every page, grouped and sorted into visual lines.
 * Returns an array of token arrays (one inner array per visual line).
 */
async function extractLines(file: File): Promise<string[][]> {
    const data = await file.arrayBuffer();
    const pdf  = await pdfjsLib.getDocument({ data }).promise;

    const Y_BUCKET = 2; // pt tolerance for same-line grouping
    const allLines: string[][] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
        const page        = await pdf.getPage(p);
        const textContent = await page.getTextContent();

        // Group text items by rounded Y position
        const buckets = new Map<number, Array<{ x: number; text: string }>>();

        for (const raw of textContent.items as Array<{ str: string; transform: number[] }>) {
            const text = raw.str?.trim();
            if (!text) continue;

            const x = raw.transform[4];
            // Snap Y to nearest bucket so items on the same visual line collapse
            const y = Math.round(raw.transform[5] / Y_BUCKET) * Y_BUCKET;

            if (!buckets.has(y)) buckets.set(y, []);
            buckets.get(y)!.push({ x, text });
        }

        // Sort lines top-to-bottom (descending Y in PDF coordinate space)
        const sortedYs = [...buckets.keys()].sort((a, b) => b - a);

        for (const y of sortedYs) {
            const tokens = buckets
                .get(y)!
                .sort((a, b) => a.x - b.x)
                .map(i => i.text)
                .filter(t => t.length > 0);

            if (tokens.length > 0) allLines.push(tokens);
        }
    }

    return allLines;
}

async function extractCompactText(file: File): Promise<string> {
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const chunks: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = (textContent.items as Array<{ str: string }>)
            .map(item => item.str?.trim())
            .filter(Boolean)
            .join(' ');
        chunks.push(pageText);
    }

    return chunks.join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFromCompactText(compact: string, invoiceRef: string): any[] {
    const out: any[] = [];

    // Example tolerant pattern:
    // 020226 010712664 56-VD-25 PORTIMAO - RAMINHA 312333 GASOLEO 67,18 ... 107,36
    const rowRegex = /(\d{6})\s+(\d{6,14})\s+([A-Z0-9]{1,2}-[A-Z0-9]{1,2}-[A-Z0-9]{1,2}|[A-Z0-9-]{6,8})\s+(.{3,80}?)\s+(\d{4,8})\s+(GASOLEO\+?|GASÓLEO|GASOLINA|DIESEL|ADBLUE|GPL|GNV)[\s\S]{0,40}?(\d{1,3}(?:\.\d{3})?,\d{2})[\s\S]{0,40}?(\d{1,3}(?:\.\d{3})?,\d{2})/gi;

    for (const m of compact.matchAll(rowRegex)) {
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
        });
    }

    return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFromTransactionChunks(compact: string, invoiceRef: string): any[] {
    const out: any[] = [];

    // Normalise extracted PDF text before parsing:
    // - unify dash variants
    // - collapse whitespace
    // - fix split product tokens ("GAS OLEO" → "GASOLEO", "GAS OIL" → "GASOIL")
    const normalized = compact
        .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
        .replace(/\bGAS\s+OLEO\b/gi, 'GASOLEO')
        .replace(/\bGAS\s+OIL\b/gi, 'GASOIL')
        .replace(/\bGASÓ\s*LEO\b/gi, 'GASOLEO')
        .replace(/\bGASO\s+LEO\b/gi, 'GASOLEO')
        .replace(/\s+/g, ' ')
        .trim();

    // Row anchor: DDMMYY + талão (long number) + plate XX-XX-XX
    // Using explicit plate format avoids false positives on non-transaction lines.
    const rowStart = /(\d{6})\s+(\d{6,14})\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3})\s+/gi;
    const starts = [...normalized.matchAll(rowStart)];
    if (starts.length === 0) return out;

    for (let i = 0; i < starts.length; i++) {
        const m = starts[i];
        const start = m.index ?? 0;
        const end = i + 1 < starts.length ? (starts[i + 1].index ?? normalized.length) : normalized.length;
        const chunk = normalized.slice(start, end).trim();

        const dateRaw = m[1];
        const talao = m[2];
        const plateRaw = m[3]; // plate is captured directly from anchor, no ambiguity

        const productMatch = chunk.match(/\b(GASOLEO\+?|GASÓLEO|GASOLEO|GASOLINA|DIESEL|ADBLUE|GPL|GNV|GASOIL)\b/i);
        if (!productMatch) continue;

        const product = normalizeFuelToken(productMatch[1]);
        const productIdx = chunk.indexOf(productMatch[0]);
        if (productIdx < 0) continue;

        const beforeProduct = chunk.slice(0, productIdx).trim();
        const afterProduct = chunk.slice(productIdx + productMatch[0].length).trim();

        // From prefix, capture KM as last 4-8 digit integer before product.
        const prefixTokens = beforeProduct.split(/\s+/).filter(Boolean);
        let km = 0;
        let kmPos = -1;
        for (let j = prefixTokens.length - 1; j >= 0; j--) {
            if (/^\d{4,8}$/.test(prefixTokens[j])) {
                km = parseEU(prefixTokens[j]);
                kmPos = j;
                break;
            }
        }
        if (kmPos < 0) continue;

        // Station text: everything between the fixed header tokens (date, talão, plate)
        // and the KM value. The header is exactly 3 tokens (already consumed by anchor).
        // prefixTokens[0] = date, [1] = talão, [2] = plate — skip those.
        const stationTokens = prefixTokens.slice(3, kmPos);
        const posto = stationTokens.join(' ').trim();
        if (!posto) continue;

        // Numeric values after product. We search for realistic liters and total.
        // All decimal numbers after the product keyword
        const decimalTokens = (afterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || [])
            .map(cleanNumberToken)
            .filter(t => t.includes(','));
        if (decimalTokens.length < 2) continue;

        // BP structure is stable: first decimal is quantity, last is total.
        // Fallback search is limited to first 3 decimals to avoid net/IVA columns.
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
            _manualDate: bpDateToISO(dateRaw),
            'Hora': '',
            'Matrícula': formatPlate(plateRaw),
            'Km': km,
            'Posto': posto,
            'Produto': product,
            'Litros': litros,
            'Preço Unitário': total / litros,
            'Total': total,
            '_talao': talao,
            '_invoiceRef': invoiceRef,
            _selectedCC: '',
        });
    }

    return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFromDateTalaoChunks(compact: string, invoiceRef: string): any[] {
    const out: any[] = [];

    const normalized = compact
        .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
        .replace(/\bGAS\s+OLEO\b/gi, 'GASOLEO')
        .replace(/\bGAS\s+OIL\b/gi, 'GASOIL')
        .replace(/\bGASÓ\s*LEO\b/gi, 'GASOLEO')
        .replace(/\bGASO\s+LEO\b/gi, 'GASOLEO')
        .replace(/\s+/g, ' ')
        .trim();

    // Looser anchor than parseFromTransactionChunks: only date + talao.
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

        const productMatch = chunk.match(/\b(GASOLEO\+?|GASÓLEO|GASOLEO|GASOLINA|DIESEL|ADBLUE|GPL|GNV|GASOIL)\b/i);
        if (!productMatch) continue;
        const produto = normalizeFuelToken(productMatch[1]);

        const plateMatch = chunk.match(/\b([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6})\b/i);
        const matricula = plateMatch ? formatPlate(plateMatch[1]) : 'N/D';

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

        const decimalTokens = (afterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || [])
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
                if (unit >= 0.6 && unit <= 4.5) {
                    litros = v;
                    break;
                }
            }
        }
        if (litros <= 0) continue;

        out.push({
            _manualDate: date,
            'Hora': '',
            'Matrícula': matricula,
            'Km': km,
            'Posto': posto,
            'Produto': produto,
            'Litros': litros,
            'Preço Unitário': total / litros,
            'Total': total,
            '_talao': talao,
            '_invoiceRef': invoiceRef,
            _selectedCC: '',
        });
    }

    return out;
}

/**
 * Merge any standalone "-" token that precedes a number token so that
 * e.g. ["-", "0,120"] becomes ["-0,120"].
 */
function mergeNegatives(tokens: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '-' && i + 1 < tokens.length && /^[\d,]+/.test(tokens[i + 1])) {
            out.push('-' + tokens[i + 1]);
            i++;
        } else {
            out.push(tokens[i]);
        }
    }
    return out;
}

/**
 * Try to parse a line token array as a BP transaction row.
 * Returns null if the line doesn't look like a transaction.
 *
 * Expected token layout:
 *   [0] DDMMYY
 *   [1] talão number (6-12 digits)
 *   [2] vehicle plate  XX-XX-XX
 *   [3..kmIdx-1] station name tokens
 *   [kmIdx] KM (large integer)
 *   [productIdx] fuel product
 *   [productIdx+1..productIdx+8] numeric columns:
 *     qty | listPrice | discount | unitPrice | IVA% | net | IVAamt | total
 */
function parseTransactionLine(
    rawTokens: string[],
    invoiceRef: string
): BPInvoiceTransaction | null {
    const tokens = normalizeLineTokens(rawTokens);

    if (tokens.length < 6) return null;

    const dateIdx = tokens.findIndex(t => DATE_TOKEN_RE.test(t));
    if (dateIdx < 0) return null;

    const talaoIdx = tokens.findIndex((t, i) => i > dateIdx && /^\d{6,14}$/.test(t));
    if (talaoIdx < 0) return null;

    const plateIdx = tokens.findIndex((t, i) => i > talaoIdx && (PLATE_RE.test(t) || PLATE_COMPACT_RE.test(t)));
    if (plateIdx < 0) return null;

    // Find the product token (anchor)
    let productIdx = -1;
    for (let i = plateIdx + 1; i < tokens.length; i++) {
        if (isFuelToken(tokens[i])) {
            productIdx = i;
            break;
        }
    }
    if (productIdx < 0) return null;

    // KM is typically the closest integer token before product
    let kmIdx = -1;
    for (let i = productIdx - 1; i > plateIdx; i--) {
        if (/^\d{4,8}$/.test(tokens[i])) {
            kmIdx = i;
            break;
        }
    }
    if (kmIdx < 0) return null;

    // Station name: tokens between plate and KM
    const posto = tokens.slice(plateIdx + 1, kmIdx).join(' ').trim();
    if (!posto) return null;

    // Numeric tokens after product
    const afterProductRaw = tokens.slice(productIdx + 1);
    const afterProduct = afterProductRaw
        .filter(t => NUMERIC_TOKEN_RE.test(cleanNumberToken(t)));
    if (afterProduct.length < 2) return null; // Need at least litros + total

    // Map to named columns (8 columns expected; be lenient if fewer)
    const [
        qtyStr       = '0',
        listPriceStr = '0',
        discountStr  = '0',
        unitPriceStr = '0',
        ivaPercentStr= '0',
        netStr       = '0',
        ivaAmtStr    = '0',
        totalStr     = '0',
    ] = afterProduct;

    // If only 7 numeric values came through, the discount column is probably absent;
    // shift: qty | listPrice | unitPrice | IVA% | net | IVAamt | total
    let litros: number, precoLista: number, desconto: number,
        precoUnitario: number, ivaPercent: number, valorLiquido: number,
        ivaValue: number, total: number;

    if (afterProduct.length >= 8) {
        litros        = parseEU(cleanNumberToken(qtyStr));
        precoLista    = parseEU(cleanNumberToken(listPriceStr));
        desconto      = parseEU(cleanNumberToken(discountStr));
        precoUnitario = parseEU(cleanNumberToken(unitPriceStr));
        ivaPercent    = parseEU(cleanNumberToken(ivaPercentStr));
        valorLiquido  = parseEU(cleanNumberToken(netStr));
        ivaValue      = parseEU(cleanNumberToken(ivaAmtStr));
        total         = parseEU(cleanNumberToken(totalStr));
    } else {
        // 7-column variant (no explicit discount column)
        litros        = parseEU(cleanNumberToken(afterProduct[0] ?? '0'));
        precoLista    = parseEU(cleanNumberToken(afterProduct[1] ?? '0'));
        desconto      = 0;
        precoUnitario = parseEU(cleanNumberToken(afterProduct[2] ?? '0'));
        ivaPercent    = parseEU(cleanNumberToken(afterProduct[3] ?? '0'));
        valorLiquido  = parseEU(cleanNumberToken(afterProduct[4] ?? '0'));
        ivaValue      = parseEU(cleanNumberToken(afterProduct[5] ?? '0'));
        total         = parseEU(cleanNumberToken(afterProduct[6] ?? '0'));
    }

    // Fallback when columns are partially missing/misaligned
    if ((!Number.isFinite(total) || total <= 0) && afterProduct.length >= 1) {
        total = parseEU(cleanNumberToken(afterProduct[afterProduct.length - 1] ?? '0'));
    }
    if ((!Number.isFinite(precoUnitario) || precoUnitario <= 0) && litros > 0 && total > 0) {
        precoUnitario = total / litros;
    }

    // Final safety checks to skip accidental header/footer captures
    if (!Number.isFinite(litros) || litros <= 0) return null;
    if (!Number.isFinite(total) || total <= 0) return null;

    return {
        date:         bpDateToISO(tokens[dateIdx]),
        talaoCupao:   tokens[talaoIdx],
        matricula:    formatPlate(tokens[plateIdx]),
        posto,
        km:           parseEU(cleanNumberToken(tokens[kmIdx])),
        produto:      normalizeFuelToken(tokens[productIdx]) || tokens[productIdx].toUpperCase(),
        litros,
        precoLista,
        desconto,
        precoUnitario,
        ivaPercent,
        valorLiquido,
        ivaValue,
        total,
        invoiceRef,
    };
}

/**
 * Product-centric parser: anchors on every GASOLEO/DIESEL occurrence and
 * reconstructs the full transaction by scanning context before/after.
 * This is the most robust approach and handles all line-breaking variants.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseProductCentric(compact: string, invoiceRef: string): any[] {
    const out: any[] = [];

    const norm = compact
        .replace(/[\u2010-\u2014]/g, '-')
        .replace(/\bGAS\s+OLEO\b/gi, 'GASOLEO')
        .replace(/\bGAS\s+OIL\b/gi, 'GASOIL')
        .replace(/\bGASO\s+LEO\b/gi, 'GASOLEO')
        .replace(/\bGASÓ\s*LEO\b/gi, 'GASOLEO')
        .replace(/\bGAS\s+OLINA\b/gi, 'GASOLINA')
        .replace(/\s+/g, ' ')
        .trim();

    // Match every fuel product occurrence in the entire text
    const productRe = /\b(GASOLEO\+?|GASOLINA|DIESEL|ADBLUE|GPL|GNV|GASOIL)\b/gi;

    for (const productMatch of norm.matchAll(productRe)) {
        const productPos = productMatch.index!;
        const productWord = productMatch[0];
        const product = normalizeFuelToken(productWord);

        // Scan backwards up to 300 chars for transaction header fields
        const before = norm.slice(Math.max(0, productPos - 300), productPos);
        // Short window avoids pulling totals from the next transaction
        const after = norm.slice(productPos + productWord.length, productPos + productWord.length + 120);

        // Date: last VALID DDMMYY token in the before-context.
        // IMPORTANT: KM values are often 6 digits too (e.g. 312333).
        // We validate DD/MM/YY ranges so we don't confuse KM with date.
        const allSixDigits = [...before.matchAll(/\b(\d{6})\b/g)];
        const validDateMatches = allSixDigits.filter(m => isValidBPDate(m[1]));
        const dateMatch = validDateMatches.at(-1);
        if (!dateMatch) continue;
        const dateToken = dateMatch[1];
        const date = bpDateToISO(dateToken);

        // Talão: first long digit sequence immediately after the validated date
        const afterDate = before.slice(dateMatch.index! + 6);
        const talaoMatch = afterDate.match(/\b(\d{6,14})\b/);
        const talao = talaoMatch?.[1] ?? '';

        // Plate: last XX-XX-XX pattern in before-context
        const allPlates = [...before.matchAll(/\b([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3})\b/gi)];
        const plateToken = allPlates.at(-1)?.[1];
        if (!plateToken) continue;
        const plate = formatPlate(plateToken);

        // KM: last 4–8 digit integer immediately before the product (within 100 chars)
        // Exclude the 6-digit date token itself from KM candidates.
        const nearProduct = before.slice(-100);
        const allKm = [...nearProduct.matchAll(/\b(\d{4,8})\b/g)]
            .filter(m => !isValidBPDate(m[1]));  // skip date-like numbers
        const kmToken = allKm.at(-1)?.[1] ?? '0';
        const km = parseEU(kmToken);

        // Station: text between the plate and the KM in before-context
        const platePos = before.lastIndexOf(plateToken);
        const kmPosInBefore = kmToken !== '0' ? before.lastIndexOf(kmToken) : -1;
        const postoRaw = platePos >= 0 && kmPosInBefore > platePos
            ? before.slice(platePos + plateToken.length, kmPosInBefore).trim()
            : '';
        const posto = postoRaw.replace(/\s{2,}/g, ' ').trim() || 'N/D';

        // Numeric values after product keyword
        const decNums = (after.match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || [])
            .map(cleanNumberToken);
        if (decNums.length < 2) continue;

        // First decimal is quantity; last is total. Fallback only on first 3 decimals.
        const total = parseEU(decNums.at(-1)!);
        if (total <= 0) continue;

        let litros = parseEU(decNums[0]);
        let unit = litros > 0 ? total / litros : 0;
        if (!(litros > 0 && litros <= 200 && unit >= 0.6 && unit <= 4.5)) {
            litros = 0;
            for (const t of decNums.slice(0, Math.min(3, decNums.length - 1))) {
                const v = parseEU(t);
                if (v <= 0 || v > 200) continue;
                unit = total / v;
                if (unit >= 0.6 && unit <= 4.5) { litros = v; break; }
            }
        }
        if (litros <= 0) continue;

        out.push({
            _manualDate: date,
            'Hora': '',
            'Matrícula': plate,
            'Km': km,
            'Posto': posto,
            'Produto': product,
            'Litros': litros,
            'Preço Unitário': total / litros,
            'Total': total,
            '_talao': talao,
            '_invoiceRef': invoiceRef,
            _selectedCC: '',
        });
    }

    return out;
}

// ─── public API ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseBPInvoicePDF = async (file: File): Promise<any[]> => {
    const lines = await extractLines(file);
    const compact = await extractCompactText(file);

    // Grab invoice ref from any method
    let invoiceRef = '';
    for (const tokens of lines) {
        const t = tokens.join(' ');
        const m = t.match(/\bPT\d{3}\/\d+\b/i);
        if (m) { invoiceRef = m[0]; break; }
    }
    if (!invoiceRef) {
        const m = compact.match(/\bPT\d{3}\/\d+\b/i);
        if (m) invoiceRef = m[0];
    }

    // 1. Product-centric (most robust – anchor on fuel keyword)
    const productRows = parseProductCentric(compact, invoiceRef);

    // 2. Chunk-based (anchor on date+talão+plate)
    const chunkRows = parseFromTransactionChunks(compact, invoiceRef);
    const dateTalaoRows = parseFromDateTalaoChunks(compact, invoiceRef);

    // 3. Column-line based (per-visual-line approach, handles 1–3 joined lines)
    const lineRows: any[] = [];
    for (let i = 0; i < lines.length; i++) {
        const tokens = lines[i];
        let tx = parseTransactionLine(tokens, invoiceRef);
        if (!tx && i + 1 < lines.length)
            tx = parseTransactionLine([...tokens, ...lines[i + 1]], invoiceRef);
        if (!tx && i + 2 < lines.length)
            tx = parseTransactionLine([...tokens, ...lines[i + 1], ...lines[i + 2]], invoiceRef);
        if (tx) lineRows.push(toPreviewRow(tx));
    }

    // 4. Regex-compact (original simplest method)
    const compactRows = parseFromCompactText(compact, invoiceRef);

    // Combine all results; order defines precedence for dedupe-by-talão.
    const all = dedupePreviewRows([...chunkRows, ...lineRows, ...dateTalaoRows, ...compactRows, ...productRows]);

    // Sort by date + plate so preview is human-readable
    all.sort((a, b) => {
        const da = a._manualDate || '';
        const db = b._manualDate || '';
        if (da !== db) return da.localeCompare(db);
        return String(a['Matrícula'] || '').localeCompare(String(b['Matrícula'] || ''));
    });

    if (all.length === 0) {
        // Log raw text to console so developer can inspect actual PDF content
        console.warn('[BP Parser] Nenhuma transação encontrada. Texto bruto do PDF:');
        console.warn(compact.slice(0, 3000));
    }

    return all;
};
