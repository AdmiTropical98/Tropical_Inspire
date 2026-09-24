import * as pdfjsLib from 'pdfjs-dist';

// Configurar o worker do PDF.js
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// ---- INTERFACES ----
export interface ParsedBPTransaction {
    _manualDate: string;
    Hora: string;
    'Matrícula': string;
    Km: string;
    Posto: string;
    Produto: string;
    Litros: number;
    'Preço Unitário': number;
    Total: number;
    _talao: string;
    _invoiceRef: string;
    _source: string;
    _selectedCC: string;
}

// ---- HELPER PARSERS ----
const parseEU = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(clean) || 0;
};

const cleanNumberToken = (val: string): string => {
    return val.replace(/[^0-9.,-]/g, '');
};

const normalizeFuelToken = (val: string): string => {
    const raw = val.toUpperCase().replace(/\s+/g, '');
    if (raw.includes('GASOLEO') || raw.includes('GASÓLEO') || raw.includes('DIESEL') || raw.includes('GASOIL')) {
        return 'Gasóleo';
    }
    if (raw.includes('ULTIMATE') || raw.includes('ULT')) return 'Gasóleo Ultimate';
    if (raw.includes('GASOLINA')) return 'Gasolina';
    if (raw.includes('ADBLUE')) return 'AdBlue';
    if (raw.includes('GPL') || raw.includes('GNV')) return 'GPL';
    return 'Gasóleo'; // Default fallback
};

const fixPlateOCR = (plate: string): string => {
    return plate.replace(/O/gi, '0');
};

const normalizeDate = (raw: string): string => {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 6) {
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/20${digits.slice(4, 6)}`;
    }
    if (raw.includes('-') || raw.includes('/') || raw.includes('.')) {
        const parts = raw.split(/[-/.]/);
        if (parts.length >= 3) {
            let year = parts[2];
            if (year.length === 2) year = `20${year}`;
            return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${year}`;
        }
    }
    return raw;
};

// ---- PIPELINE STAGE 1: TEXT EXTRACTION ----
async function extractLinesFromPDF(fileData: Uint8Array): Promise<string[][]> {
    const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
    const allLines: string[][] = [];
    const Y_BUCKET = 1;

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const buckets = new Map<number, { x: number; text: string }[]>();

        for (const raw of textContent.items as Array<{ str: string; transform: number[] }>) {
            const text = raw.str?.trim();
            if (!text) continue;

            let vx = raw.transform[4];
            let vy = raw.transform[5];

            // Handle 90/270 degree rotated PDFs
            if (Math.abs(raw.transform[0]) < 0.001 && Math.abs(raw.transform[1]) > 0) {
                vx = raw.transform[5];
                vy = -raw.transform[4];
            }

            const y = Math.round(vy / Y_BUCKET) * Y_BUCKET;

            if (!buckets.has(y)) buckets.set(y, []);
            buckets.get(y)!.push({ x: vx, text });
        }

        const sortedYs = [...buckets.keys()].sort((a, b) => b - a);
        for (const y of sortedYs) {
            const tokens = buckets.get(y)!
                .sort((a, b) => a.x - b.x)
                .map(i => i.text)
                .filter(t => t.length > 0);
            if (tokens.length > 0) {
                allLines.push(tokens);
            }
        }
    }

    return allLines;
}

// ---- PIPELINE STAGE 2: SEGMENTATION ----
interface CardBlock {
    cardNumber: string;
    lines: string[][];
}

function segmentIntoCardBlocks(lines: string[][]): CardBlock[] {
    const blocks: CardBlock[] = [];
    let currentBlock: CardBlock | null = null;

    const CARD_START_RE = /CART[ÃA]O\s*(?:N[.ºO]?|N\.)?\s*(\d{10,})/i;
    const BLOCK_END_RE = /(TOTAL\s*DO\s*CART|RESUMO\s*DO\s*IVA|TOTAL\s*FATURA|TOTAL\s*A\s*TRANSPORTAR|SUBTOTAL|TOTAL\s*GERAL|RESUMO\s*DE\s*PRODUTOS|P[ÁA]GINA)/i;

    for (const lineTokens of lines) {
        const fullLine = lineTokens.join(' ');

        // Check for start of a new card block
        const startMatch = fullLine.match(CARD_START_RE);
        if (startMatch) {
            currentBlock = {
                cardNumber: startMatch[1],
                lines: []
            };
            blocks.push(currentBlock);
            continue;
        }

        // If we are inside a block
        if (currentBlock) {
            // Check for end of the block
            if (BLOCK_END_RE.test(fullLine)) {
                currentBlock = null;
                continue;
            }

            // Accumulate lines for this block
            currentBlock.lines.push(lineTokens);
        }
    }

    return blocks;
}

// ---- PIPELINE STAGE 3: EXTRACTION ----
function extractTransactionsFromBlock(block: CardBlock, invoiceRef: string): ParsedBPTransaction[] {
    const transactions: ParsedBPTransaction[] = [];
    
    // We expect lines to contain Date, Receipt, Plate, Location, Km, Fuel, Liter, Unit, Total
    // However, some fields might be empty or combined. We'll merge the tokens and run a regex.
    const TRANSACTION_REGEX = /^(\d{6}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})\s+(\d{5,14})\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)\s+(.+?)\s+(?:(\d{3,8})\s+)?(GAS\s*OLEO\+?|GAS\s*ÓLEO|GAS\s*OLEO|GAS\s*OIL|DIESEL|ULTIMATE|ULT\s*DIESEL|ULT|GASOLINA|ADBLUE-?\w*|GPL|GNV)\s+(.+)$/i;

    for (const lineTokens of block.lines) {
        const fullLine = lineTokens.join(' ');
        
        // BUG FIX: O PDF.js agrupa transações na mesma string se tiverem o mesmo Y_BUCKET.
        // Dividimos a string em múltiplas caso existam múltiplos inícios de transação.
        const matches = [...fullLine.matchAll(/(?:^|\s)(\d{6}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})\s+(\d{5,14})\s+([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}|[A-Z0-9]{6}|OFICINA)/gi)];
        
        const subLines = [];
        if (matches.length > 1) {
            for (let i = 0; i < matches.length; i++) {
                const start = matches[i].index ?? 0;
                const end = i + 1 < matches.length ? (matches[i + 1].index ?? fullLine.length) : fullLine.length;
                subLines.push(fullLine.substring(start, end).trim());
            }
        } else {
            subLines.push(fullLine);
        }

        for (const subLine of subLines) {
            const match = subLine.match(TRANSACTION_REGEX);
            
            if (!match) continue;

            const rawDate = match[1];
            const receipt = match[2];
            const plate = fixPlateOCR(match[3]);
            const location = match[4].trim();
            const km = match[5] || '';
            const fuelToken = match[6];
            const tail = match[7];

        const decimals = [...tail.matchAll(/-?\d{1,3}(?:\.\d{3})?,\d+/g)].map(v => cleanNumberToken(v[0]));
        if (decimals.length < 2) continue;

        const rawTotal = parseEU(decimals[decimals.length - 1]);
        if (rawTotal <= 0) continue;

        let liters = parseEU(decimals[0]);
        let unitPrice = liters > 0 ? rawTotal / liters : 0;

        // Stage 4: Strict validation (0.60 to 4.50 EUR/Liter)
        if (!(liters > 0 && liters <= 200 && unitPrice >= 0.6 && unitPrice <= 4.5)) {
            liters = 0;
            // Try fallback
            for (const t of decimals.slice(0, Math.min(3, decimals.length - 1))) {
                const v = parseEU(t);
                if (v <= 0 || v > 200) continue;
                unitPrice = rawTotal / v;
                if (unitPrice >= 0.6 && unitPrice <= 4.5) {
                    liters = v;
                    break;
                }
            }
        }

        if (liters <= 0) continue; // Failed strict validation

        transactions.push({
            _manualDate: normalizeDate(rawDate),
            Hora: '', // BP doesn't usually provide time in this block
            'Matrícula': plate,
            Km: km,
            Posto: location,
            Produto: normalizeFuelToken(fuelToken),
            Litros: liters,
            'Preço Unitário': rawTotal / liters,
            Total: rawTotal,
            _talao: receipt,
            _invoiceRef: invoiceRef,
            _source: 'block_parser',
            _selectedCC: '',
        });
        }
    }

    return transactions;
}

// ---- PIPELINE STAGE 5: DEDUPLICATION ----
function deduplicateTransactions(transactions: ParsedBPTransaction[]): ParsedBPTransaction[] {
    const seen = new Set<string>();
    const unique: ParsedBPTransaction[] = [];

    for (const tx of transactions) {
        // Unique key: Talao + Date + Plate + Total + Liters
        const key = `${tx._talao}_${tx._manualDate}_${tx['Matrícula']}_${tx.Total}_${tx.Litros}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(tx);
        }
    }

    return unique;
}

// ---- MAIN ENTRY POINT ----
export async function parseBPInvoicePDF(file: File | Blob | Uint8Array | ArrayBuffer): Promise<ParsedBPTransaction[]> {
    let fileData: Uint8Array;
    if (file instanceof Uint8Array) {
        fileData = file;
    } else if (file instanceof ArrayBuffer) {
        fileData = new Uint8Array(file);
    } else {
        const buf = await file.arrayBuffer();
        fileData = new Uint8Array(buf);
    }

    // 1. Extract raw lines
    const lines = await extractLinesFromPDF(fileData);

    // 2. Segment by cards
    const blocks = segmentIntoCardBlocks(lines);

    // Look for Invoice Ref in all lines
    let invoiceRef = 'DESCONHECIDO';
    for (const line of lines) {
        const full = line.join(' ');
        const refMatch = full.match(/Fatura\s*n[º.o°]?\s*:?\s*([A-Z0-9\s/]+)/i);
        if (refMatch) {
            invoiceRef = refMatch[1].trim();
            break;
        }
    }

    // 3 & 4. Parse blocks
    let allTransactions: ParsedBPTransaction[] = [];
    for (const block of blocks) {
        const txs = extractTransactionsFromBlock(block, invoiceRef);
        allTransactions = allTransactions.concat(txs);
    }

    // 5. Deduplicate
    return deduplicateTransactions(allTransactions);
}
