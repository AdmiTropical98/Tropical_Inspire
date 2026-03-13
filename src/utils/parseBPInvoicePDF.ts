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
const FUEL_PRODUCT_RE =
    /^(GASOLEO|GASOLEO\+|GASÓLEO|GASOLINA|DIESEL|GNV|G\.N\.V\.?|BIODIESEL|ADBLUE|GPL|SUPER|GAS(OIL)?)/i;

/** Portuguese plate formats: XX-XX-XX (letters or digits in each segment) */
const PLATE_RE = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/i;

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

const cleanNumberToken = (val: string): string => {
    const trimmed = val.trim().replace(/%/g, '');
    if (trimmed === '-') return '0';
    return trimmed;
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
    const tokens = mergeNegatives(rawTokens);

    if (tokens.length < 6) return null;

    const dateIdx = tokens.findIndex(t => DATE_TOKEN_RE.test(t));
    if (dateIdx < 0) return null;

    const talaoIdx = tokens.findIndex((t, i) => i > dateIdx && /^\d{6,14}$/.test(t));
    if (talaoIdx < 0) return null;

    const plateIdx = tokens.findIndex((t, i) => i > talaoIdx && PLATE_RE.test(t));
    if (plateIdx < 0) return null;

    // Find the product token (anchor)
    let productIdx = -1;
    for (let i = plateIdx + 1; i < tokens.length; i++) {
        if (FUEL_PRODUCT_RE.test(tokens[i])) {
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
    const afterProduct = tokens
        .slice(productIdx + 1)
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

    // Final safety checks to skip accidental header/footer captures
    if (!Number.isFinite(litros) || litros <= 0) return null;
    if (!Number.isFinite(total) || total <= 0) return null;

    return {
        date:         bpDateToISO(tokens[dateIdx]),
        talaoCupao:   tokens[talaoIdx],
        matricula:    tokens[plateIdx].toUpperCase(),
        posto,
        km:           parseEU(cleanNumberToken(tokens[kmIdx])),
        produto:      tokens[productIdx].toUpperCase(),
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

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Parse a BP Mobility invoice PDF and return the list of fuel transactions.
 * Returns the transactions shaped as the `bpTransactions` row format used
 * by the Combustivel page, so they can be fed directly into the existing
 * preview table and confirmation flow without extra mapping.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseBPInvoicePDF = async (file: File): Promise<any[]> => {
    const lines = await extractLines(file);

    let invoiceRef = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: any[] = [];

    for (let i = 0; i < lines.length; i++) {
        const tokens = lines[i];
        const lineText = tokens.join(' ');

        // Capture invoice reference from header (e.g. "PT011/937408")
        if (!invoiceRef) {
            const refMatch = lineText.match(/\bPT\d{3}\/\d+\b/i);
            if (refMatch) invoiceRef = refMatch[0];
        }

        let tx = parseTransactionLine(tokens, invoiceRef);

        // Some Summary Statement PDFs split one transaction in two visual lines.
        // Fallback: try current + next line as a single record.
        if (!tx && i + 1 < lines.length) {
            tx = parseTransactionLine([...tokens, ...lines[i + 1]], invoiceRef);
            if (tx) i += 1;
        }

        if (!tx) continue;

        // Shape into the format expected by the existing bpTransactions preview
        transactions.push({
            // Date stored in _manualDate so the existing date-parsing path works
            _manualDate: tx.date,
            'Hora': '',
            'Matrícula': tx.matricula,
            'Km': tx.km,
            'Posto': tx.posto,
            'Produto': tx.produto,
            'Litros': tx.litros,
            'Preço Unitário': tx.precoUnitario,
            'Total': tx.total,
            // Extra fields for information (not used by import logic, but visible in debug)
            '_talao': tx.talaoCupao,
            '_ivaPercent': tx.ivaPercent,
            '_ivaValue': tx.ivaValue,
            '_valorLiquido': tx.valorLiquido,
            '_invoiceRef': tx.invoiceRef,
            // Cost centre – empty by default, user selects in preview
            _selectedCC: '',
        });
    }

    return transactions;
};
