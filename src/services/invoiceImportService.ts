import { supabase } from '../lib/supabase';
import type { InvoiceImport, InvoiceImportStatus, InvoiceUnit } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import type { InvoiceImportExtractedData, InvoiceImportExtractedProduct } from '../types';

const INVOICE_IMPORT_BUCKET = 'invoices';
const FALLBACK_IMPORT_BUCKET = 'documents';
const IMPORT_BUCKETS = [INVOICE_IMPORT_BUCKET, FALLBACK_IMPORT_BUCKET];

const randomToken = () => Math.random().toString(36).slice(2);

const resolveImportStatus = (status: unknown): InvoiceImportStatus => {
    if (status === 'ready' || status === 'processing' || status === 'confirmed' || status === 'failed') {
        return status;
    }
    if (status === 'error') return 'failed';
    return 'processing';
};

const normalizeImportRow = (row: any): InvoiceImport => ({
    ...row,
    file_path: row?.file_path || row?.storage_path || '',
    status: resolveImportStatus(row?.status),
    error: row?.error ?? row?.error_message ?? null,
});

const getMissingColumn = (error: any): string | null => {
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    const combined = `${message}\n${details}`;

    const postgrestMatch = combined.match(/Could not find the '([^']+)' column/i);
    if (postgrestMatch?.[1]) return postgrestMatch[1];

    const postgresMatch = combined.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
    if (postgresMatch?.[1]) return postgresMatch[1];

    return null;
};

const resolveImportStoragePath = (row: any): string => row?.file_path || row?.storage_path || '';

const toNumber = (value: string | number): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (!value || typeof value !== 'string') return 0;
    const normalized = value
        .replace(/\s/g, '')
        .replace(/€/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const dmy = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (dmy) {
        const d = dmy[1].padStart(2, '0');
        const m = dmy[2].padStart(2, '0');
        const y = dmy[3];
        return `${y}-${m}-${d}`;
    }

    const ymd = trimmed.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    if (ymd) {
        const y = ymd[1];
        const m = ymd[2].padStart(2, '0');
        const d = ymd[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return '';
};

const findLabeledDate = (lines: string[], labelRegexes: RegExp[]): string => {
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!labelRegexes.some((regex) => regex.test(line))) continue;

        const candidates = [
            line,
            lines[index + 1] || '',
            lines[index + 2] || '',
        ];

        for (const candidate of candidates) {
            const dateMatch = candidate.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})/);
            if (dateMatch?.[1]) {
                const iso = toIsoDate(dateMatch[1]);
                if (iso) return iso;
            }
        }
    }

    return '';
};

const findOrderLineDate = (lines: string[]): string => {
    for (const line of lines) {
        if (!/ordof|o\.r\.|or\/?of/i.test(line)) continue;
        const dateMatch = line.match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{4}-\d{2}-\d{2})/i);
        if (dateMatch?.[1]) {
            const iso = toIsoDate(dateMatch[1]);
            if (iso) return iso;
        }
    }

    return '';
};

const findOrderDateInCompactText = (compact: string): string => {
    const match = compact.match(/ordof\s*\/?\s*[a-z0-9\/-]+\s+(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2})/i)
        || compact.match(/o\.r\.\s*\/?\s*[a-z0-9\/-]+\s+(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2})/i);

    return match?.[1] ? toIsoDate(match[1]) : '';
};

const clampVat = (value: number): 0 | 6 | 13 | 23 => {
    const rounded = Math.round(value);
    if (rounded === 6 || rounded === 13 || rounded === 23) return rounded;
    return 0;
};

interface PositionalItem {
    text: string;
    x: number;
    w?: number;
}

interface PositionalRow {
    y: number;
    items: PositionalItem[];
}

const extractPdfRowsByGeometry = async (file: File): Promise<PositionalRow[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true } as any).promise;
    const allRows: PositionalRow[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const entries: (PositionalItem & { y: number })[] = [];
        (content.items as any[]).forEach((item) => {
            const str = String(item?.str || '').trim();
            if (!str) return;

            const x = Number(item?.transform?.[4] || 0);
            const y = Number(item?.transform?.[5] || 0);
            const w = Number(item?.width || 0);

            // Split on 2+ spaces OR space between number and unit/price
            const parts = str.split(/(\s{2,})|(?<=\d)\s+(?=[A-Z])|(?<=[A-Z])\s+(?=\d)|(?<=\d)\s+(?=\d)/i);
            if (parts.length > 1) {
                let currentOffset = 0;
                parts.forEach((part) => {
                    if (part === undefined) return;
                    if (!part || /^\s+$/.test(part)) {
                        currentOffset += part?.length || 0;
                        return;
                    }
                    const partStr = part.trim();
                    if (partStr) {
                        const partX = x + (currentOffset / str.length) * w;
                        entries.push({ text: partStr, x: partX, y, w: (partStr.length / str.length) * w });
                    }
                    currentOffset += part.length;
                });
            } else {
                entries.push({ text: str, x, y, w });
            }
        });

        const groups: Map<number, PositionalItem[]> = new Map();
        for (const entry of entries) {
            let foundY: number | null = null;
            for (const y of groups.keys()) {
                if (Math.abs(y - entry.y) <= 5.5) {
                    foundY = y;
                    break;
                }
            }

            if (foundY !== null) {
                groups.get(foundY)!.push({ text: entry.text, x: entry.x, w: entry.w });
            } else {
                groups.set(entry.y, [{ text: entry.text, x: entry.x, w: entry.w }]);
            }
        }

        const sortedGroups = Array.from(groups.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([y, items]) => ({
                y,
                items: items.sort((a, b) => a.x - b.x),
            }));

        allRows.push(...sortedGroups);
    }

    return allRows;
};

const extractPdfLines = async (file: File): Promise<string[]> => {
    const rows = await extractPdfRowsByGeometry(file);
    return rows.map((row) => row.items.map((item) => item.text).join(' ')).filter(Boolean);
};

const rasterizeFirstPageOfPdf = async (file: File): Promise<File> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true } as any).promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2d context for canvas');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
    
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                resolve(new File([blob], `${nameWithoutExt}.jpeg`, { type: 'image/jpeg' }));
            } else {
                reject(new Error('Canvas to Blob failed'));
            }
        }, 'image/jpeg', 0.9);
    });
};

const findLabeledAmount = (lines: string[], labelRegexes: RegExp[]): number => {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (!labelRegexes.some((regex) => regex.test(line))) continue;

        const numberMatches = [...line.matchAll(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/g)]
            .map((match) => toNumber(match[1]))
            .filter((value) => value > 0);

        if (numberMatches.length > 0) return numberMatches[numberMatches.length - 1];
    }

    return 0;
};

const extractAmountAfterLabelInCompact = (compact: string, labelRegexes: RegExp[]): number => {
    for (const regex of labelRegexes) {
        const match = compact.match(new RegExp(`${regex.source}[^\\d]{0,20}(\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d{2})|\\d+(?:[.,]\d{2}))`, 'i'));
        if (match?.[1]) {
            const value = toNumber(match[1]);
            if (value > 0) return value;
        }
    }
    return 0;
};

const extractSummaryTotalsFromCompact = (compact: string): { net: number; vat: number; total: number; discounts?: number } => {
    const get = (regexes: RegExp[]): number => {
        for (const regex of regexes) {
            const match = compact.match(regex);
            if (match?.[1]) {
                const value = toNumber(match[1]);
                if (value > 0) return value;
            }
        }
        return 0;
    };

    const net = get([
        /total\s+il[ií]quido\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /il[ií]quido\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /base\s+tribut[aá]vel\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /total\s+l[ií]quido\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
    ]);

    const vat = get([
        /total\s+iva\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /\biva\b\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
    ]);

    const total = get([
        /total\s+a\s+pagar\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /total\s+documento\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /\btotal\b\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
    ]);

    return { net, vat, total };
};

const extractInvoiceNumber = (lines: string[], compact: string, _fallbackName: string): string => {
    const normalize = (value: string) =>
        value.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').trim().toUpperCase();

    // 1. Formatos explicitamente identificados como número de documento/fatura.
    const labeledPatterns = [
        /(?:N[º°o.]?\s*(?:DA\s*)?FATURA|N[ÚU]MERO\s+DA\s+FATURA|N[º°o.]?\s*DOCUMENTO|DOCUMENTO\s+N[º°o.]?)\s*[:\-]?\s*([A-Z]{1,6}\s*[\w./-]{2,30})/i,
        /(?:FATURA|FACTURA)\s*(?:N[º°o.]?)?\s*[:\-]?\s*([A-Z]{0,6}\s*\d[\w./-]{1,30})/i,
    ];

    for (const line of lines) {
        for (const pattern of labeledPatterns) {
            const match = line.match(pattern);
            if (!match?.[1]) continue;

            const value = normalize(match[1]);
            // Nunca aceitar uma requisição como número da fatura.
            if (/^(?:R|REQ|REQUISI[CÇ][AÃ]O)[\s:/-]*\d/i.test(value)) continue;
            return value;
        }
    }

    // 2. Formatos portugueses habituais: FTA 458126/381, FT 123/456, etc.
    for (const line of lines) {
        const match =
            line.match(/\b(FTA\s*\d{3,}(?:\s*\/\s*\d+)?)\b/i) ||
            line.match(/\b(FT\s*[A-Z0-9/-]+)\b/i);

        if (match?.[1]) return normalize(match[1]);
    }

    // 3. Procurar no texto compacto.
    const compactMatch =
        compact.match(/\b(FTA\s*\d{3,}(?:\s*\/\s*\d+)?)\b/i) ||
        compact.match(/\b(FT\s*[A-Z0-9/-]+)\b/i);

    if (compactMatch?.[1]) return normalize(compactMatch[1]);

    // 4. Nunca usar o nome do ficheiro como número da fatura: isso pode
    // confundir o número da requisição (ex.: 26-0046) com a fatura.
    return '';
};

const inferVatPercentFromTotals = (total: number, vatTotal: number): 0 | 6 | 13 | 23 => {
    if (total <= 0 || vatTotal <= 0 || vatTotal >= total) return 23;

    const net = total - vatTotal;
    const inferred = (vatTotal / net) * 100;
    const candidates: Array<0 | 6 | 13 | 23> = [6, 13, 23, 0];

    let best: 0 | 6 | 13 | 23 = 23;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
        const diff = Math.abs(candidate - inferred);
        if (diff < bestDiff) {
            best = candidate;
            bestDiff = diff;
        }
    }

    return bestDiff <= 2 ? best : 23;
};

type ParsedInvoiceLine = {
    description: string;
    unidade_medida: InvoiceUnit;
    qty: number;
    unit_price: number;
    discount_percentage?: number;
    net_value?: number;
    vat_percent: 0 | 6 | 13 | 23;
    vat_value?: number;
};

const NUMBER_TOKEN_SOURCE = '(?:\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
const NUMBER_TOKEN_REGEX = new RegExp(`^${NUMBER_TOKEN_SOURCE}$`);
const NON_ITEM_LINE_REGEX = /(iban|swift|bic|nib|entidade|refer[êe]ncia|multibanco|pagamento|dados\s+banc[aá]rios|transfer[êe]ncia|vencimento|total\s+a\s+pagar|subtotal|resumo\s+do\s+iva|resumos?|a\s+transportar|original|duplicado|triplicado|segunda\s*via|valor\s*il[ií]quido|totais(?:\s+servi[çc]os\s+internos)?|transporte|continua|eticadata|software|observa[çc][oõ]es|condi[çc][oõ]es|página|descri[çc][aã]o\s+de\s+trabalhos)/i;
const TABLE_START_REGEX = /(?:arm\s+opera[çc][aã]o\/?pe[çc]a\s+descri[çc][aã]o\s+qtd\.?\s*un|(?:artigo|c[oó]digo|pe[çc]a|ref\.?|designa[çc][aã]o|descri[çc][aã]o|servi[çc]o).*?(?:qtd|quant|quantidade).*?(?:pr\.?\s*un|pre[çc]o|p\.?\s*unit|valor)|(?:descri[çc][aã]o|designa[çc][aã]o).*?(?:qtd|quant|unidade|unid|un).*?(?:pre[çc]o|pr\.?\s*unit|p\.?\s*unit)|(?:qtd|quant).*?(?:un|unid).*?(?:pre[çc]o|pr\.?\s*unit|p\.?\s*unit))/i;
const TABLE_END_REGEX = /resumo\s+do\s+iva|total\s+i?l[ií]quido|total\s+documento|totais(?:\s+servi[çc]os\s+internos)?|descri[çc][aã]o\s+de\s+trabalhos/i;
const TABLE_CONTINUE_MARKER_REGEX = /a\s+transportar|totais(?:\s+servi[çc]os\s+internos)?|transporte|continua|v\.?\s*liquido|liquido|v\.?\s*mercadoria|mercadoria/i;
const SECTION_MARKER_REGEX = /^\s*(duplicado|triplicado|segunda\s*via)\b/i;
const UNIT_ANCHOR_REGEX = /^(UN|UND|UNID|UNIDADE|UNIDADES|UNI|HOR|H|HR|HRS|HORA|HORAS|L|LT|LTS|LITRO|LITROS|CX|CAIXA|CAIXAS|MT|MTS|METRO|METROS|PC|PCS|PEÇA|PAR|KIT)$/i;

const normalizeTokenForMatch = (token: string): string => token
    .replace(/[|;]/g, ' ')
    .replace(/[()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isNumericToken = (token: string): boolean => NUMBER_TOKEN_REGEX.test(normalizeTokenForMatch(token));

const isAnchorUnitToken = (token: string): boolean => UNIT_ANCHOR_REGEX.test(normalizeTokenForMatch(token).toUpperCase());

const findFirstUnitAnchorIndex = (tokens: string[]): number => tokens.findIndex((token) => isAnchorUnitToken(token));

const normalizeAnchorUnitToInvoiceUnit = (token: string): InvoiceUnit => {
    const normalized = normalizeTokenForMatch(token).toUpperCase();
    if (!normalized) return 'UN';
    if (['HOR', 'HOF', 'HO'].includes(normalized)) return 'HOR';
    if (['H', 'HR', 'HRS', 'HORA', 'HORAS'].includes(normalized)) return 'H';
    if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(normalized)) return 'L';
    if (['CX', 'CAIXA', 'CAIXAS'].includes(normalized)) return 'CX';
    if (['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES', 'UNI', 'PC', 'PCS', 'PEÇA', 'PAR', 'KIT', 'MT', 'MTS', 'METRO', 'METROS'].includes(normalized)) return 'UN';
    return 'UN';
};

const getScopedTableLines = (rows: PositionalRow[]): PositionalRow[] => {
    const startIndex = rows.findIndex((row) => TABLE_START_REGEX.test(row.items.map(i => i.text).join(' ')));
    if (startIndex < 0) {
        // Return all rows that look like item rows (having unit anchor or numeric clusters)
        return rows.filter((row) => {
            const rowText = row.items.map(i => i.text).join(' ');
            if (NON_ITEM_LINE_REGEX.test(rowText)) return false;
            return row.items.some(i => isAnchorUnitToken(i.text));
        });
    }

    const scoped: PositionalRow[] = [];
    for (let index = startIndex + 1; index < rows.length; index += 1) {
        const row = rows[index];
        const rowText = row.items.map(i => i.text).join(' ');

        if (TABLE_START_REGEX.test(rowText)) continue;
        if (TABLE_CONTINUE_MARKER_REGEX.test(rowText)) continue;
        if (TABLE_END_REGEX.test(rowText)) {
            if (/resumo\s+do\s+iva/i.test(rowText)) break;
            continue;
        }
        if (SECTION_MARKER_REGEX.test(rowText)) break;
        if (/^\d+\s*\/\s*\d+$/i.test(rowText) || (/^\d+\s*$/i.test(rowText) && row.items.length === 1)) continue;

        scoped.push(row);
    }

    return scoped;
};

const dedupeAndReconcileLines = (
    lines: ParsedInvoiceLine[],
    _total: number,
    _vatTotal: number,
    _fallbackVatPercent: 0 | 6 | 13 | 23
): ParsedInvoiceLine[] => {
    if (!lines.length) return [];

    const seen = new Set<string>();
    return lines.filter((line) => {
        const key = [
            line.description.toLowerCase().replace(/\s+/g, ' ').trim(),
            line.unidade_medida,
            line.qty.toFixed(2),
            line.unit_price.toFixed(2),
            Number(line.discount_percentage || 0).toFixed(2),
            Number(line.net_value || 0).toFixed(2),
            line.vat_percent,
        ].join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const extractDetailedLines = (
    positionalRows: PositionalRow[],
    fallbackLines: string[],
    total: number,
    vatTotal: number,
    fallbackVatPercent: 0 | 6 | 13 | 23
): ParsedInvoiceLine[] => {
    const scopedRows = getScopedTableLines(positionalRows);
    if (!scopedRows.length) {
        return extractDetailedLinesLegacy(fallbackLines, total, vatTotal, fallbackVatPercent);
    }

    const parsed: ParsedInvoiceLine[] = [];
    let currentLine: ParsedInvoiceLine | null = null;
    let pendingDescriptionBuffer: string[] = [];

    for (const row of scopedRows) {
        const rowText = row.items.map(i => i.text).join(' ');
        if (NON_ITEM_LINE_REGEX.test(rowText)) continue;

        const tokens = row.items.sort((a, b) => a.x - b.x);
        const tokenTexts = tokens.map((item) => normalizeTokenForMatch(item.text)).filter(Boolean);
        let unitIndex = findFirstUnitAnchorIndex(tokenTexts);
        
        let qtyToken: string | undefined;
        let unitToken: InvoiceUnit = 'UN';
        let numbersAfterUnit: number[] = [];
        let descriptionTokens: string[] = [];

        if (unitIndex > 0) {
            qtyToken = tokenTexts[unitIndex - 1];
            unitToken = normalizeAnchorUnitToInvoiceUnit(tokenTexts[unitIndex]);
            numbersAfterUnit = tokenTexts.slice(unitIndex + 1).filter(isNumericToken).map(toNumber);
            descriptionTokens = tokenTexts.slice(0, unitIndex - 1);
        } else {
            const firstTextIndex = tokenTexts.findIndex(t => !isNumericToken(t));
            const lastTextIndex = tokenTexts.findLastIndex(t => !isNumericToken(t));
            
            if (firstTextIndex > 0 && lastTextIndex >= firstTextIndex) {
                qtyToken = tokenTexts[firstTextIndex - 1];
                unitToken = 'UN';
                const tailTokens = tokenTexts.slice(lastTextIndex + 1);
                numbersAfterUnit = tailTokens.filter(t => /^[0-9.,]+$/.test(t) && t.includes(',')).map(toNumber);
                descriptionTokens = tokenTexts.slice(firstTextIndex, lastTextIndex + 1);
            }
        }

        const qty = qtyToken && isNumericToken(qtyToken) ? toNumber(qtyToken) : 0;
        const unitPrice = numbersAfterUnit[0] || 0;

        if (qty > 0 && unitPrice > 0) {
            const rowDescription = descriptionTokens.join(' ').replace(/\s+/g, ' ').trim();
            const fullDescription = [...pendingDescriptionBuffer, rowDescription].join(' ').replace(/\s+/g, ' ').trim();
            pendingDescriptionBuffer = [];

            let vatPercent = fallbackVatPercent;
            for (let index = numbersAfterUnit.length - 1; index >= 1; index -= 1) {
                const candidateVat = clampVat(numbersAfterUnit[index]);
                if (candidateVat > 0) {
                    vatPercent = candidateVat;
                    break;
                }
            }

            const grossSubtotal = Number((qty * unitPrice).toFixed(2));
            let discountPercentage = 0;
            let netValue = grossSubtotal;

            if (numbersAfterUnit.length >= 5) {
                // Typical: [unit_price, %desc, desc_val, net_value, %iva]
                discountPercentage = numbersAfterUnit[1];
                netValue = numbersAfterUnit[3];
            } else if (numbersAfterUnit.length === 4) {
                // Typical: [unit_price, %desc, net_value, %iva]
                discountPercentage = numbersAfterUnit[1];
                netValue = numbersAfterUnit[2];
            } else if (numbersAfterUnit.length === 3) {
                // Typical: [unit_price, net_value, %iva]
                netValue = numbersAfterUnit[1];
                if (grossSubtotal > 0 && netValue < grossSubtotal) {
                    discountPercentage = Number((((grossSubtotal - netValue) / grossSubtotal) * 100).toFixed(2));
                }
            } else if (numbersAfterUnit.length === 2) {
                // Typical: [unit_price, net_value] or [unit_price, %iva]
                if (clampVat(numbersAfterUnit[1]) > 0 && numbersAfterUnit[1] !== grossSubtotal) {
                    vatPercent = clampVat(numbersAfterUnit[1]);
                    netValue = grossSubtotal;
                } else {
                    netValue = numbersAfterUnit[1];
                }
            }

            if (netValue <= 0) netValue = grossSubtotal;

            if (fullDescription && !NON_ITEM_LINE_REGEX.test(fullDescription)) {
                currentLine = {
                    description: fullDescription,
                    unidade_medida: unitToken,
                    qty,
                    unit_price: unitPrice,
                    discount_percentage: discountPercentage,
                    net_value: netValue,
                    vat_percent: vatPercent,
                    vat_value: Number((netValue * (vatPercent / 100)).toFixed(2))
                };
                parsed.push(currentLine);
                continue;
            }
        }

        const numberTokens = tokenTexts.filter((token) => isNumericToken(token));
        const textTokens = tokenTexts.filter((token) => !isNumericToken(token));

        if (numberTokens.length >= textTokens.length && numberTokens.length > 1) continue;

        const extraText = textTokens.join(' ').replace(/\s+/g, ' ').trim();
        if (extraText && !NON_ITEM_LINE_REGEX.test(extraText) && !TABLE_END_REGEX.test(extraText)) {
            if (currentLine) {
                currentLine.description = `${currentLine.description} ${extraText}`.trim();
            } else {
                pendingDescriptionBuffer.push(extraText);
            }
        }
    }

    if (parsed.length > 0) return parsed;
    return extractDetailedLinesLegacy(fallbackLines, total, vatTotal, fallbackVatPercent);
};

const extractDetailedLinesLegacy = (
    lines: string[],
    _total: number,
    _vatTotal: number,
    fallbackVatPercent: 0 | 6 | 13 | 23
): ParsedInvoiceLine[] => {
    const parsed: ParsedInvoiceLine[] = [];

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+/g, ' ').trim();
        if (!line || NON_ITEM_LINE_REGEX.test(line)) continue;
        if (/opera[çc][aã]o\/pe[çc]a|descri[çc][aã]o\s+qtd|total|resumo/i.test(line)) continue;

        const tokens = line.split(/\s+/).map((token) => normalizeTokenForMatch(token)).filter(Boolean);
        const unitIndex = findFirstUnitAnchorIndex(tokens);
        if (unitIndex <= 0) continue;

        const qtyToken = tokens[unitIndex - 1];
        if (!isNumericToken(qtyToken)) continue;

        const qty = toNumber(qtyToken);
        const unitMeasure = normalizeAnchorUnitToInvoiceUnit(tokens[unitIndex]);
        const numericTail = tokens.slice(unitIndex + 1).filter((token) => isNumericToken(token)).map(toNumber);
        const unitPrice = numericTail[0] || 0;
        const grossValue = Number((qty * unitPrice).toFixed(2));

        let discountPercentage = 0;
        let netValue = grossValue;

        if (numericTail.length >= 5) {
            discountPercentage = numericTail[1];
            netValue = numericTail[3];
        } else if (numericTail.length === 4) {
            discountPercentage = numericTail[1];
            netValue = numericTail[2];
        } else if (numericTail.length >= 3) {
            netValue = numericTail[numericTail.length - 2];
            if (grossValue > 0 && netValue < grossValue) {
                discountPercentage = Number((((grossValue - netValue) / grossValue) * 100).toFixed(2));
            }
        }

        const description = tokens.slice(0, unitIndex - 1).join(' ').replace(/\s+/g, ' ').trim();

        if (description && qty > 0 && unitMeasure && unitPrice > 0) {
            parsed.push({
                description,
                unidade_medida: unitMeasure,
                qty,
                unit_price: unitPrice,
                discount_percentage: discountPercentage,
                net_value: netValue,
                vat_percent: fallbackVatPercent,
                vat_value: Number((netValue * (fallbackVatPercent / 100)).toFixed(2)),
            });
        }
    }

    return parsed;
};

export async function parseInvoicePdfLocally(file: File): Promise<InvoiceImportExtractedData> {
    const positionalRows = await extractPdfRowsByGeometry(file);
    const textLines = await extractPdfLines(file);
    const seenLines = new Set<string>();
    const lines = textLines.filter((line) => {
        const normalized = line.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!normalized || seenLines.has(normalized)) return false;
        seenLines.add(normalized);
        return true;
    });
    const compact = lines.join(' ');

    const supplierMatch = compact.match(/(?:Fornecedor|Supplier)\s*[:\-]\s*([^\n\r]{2,120})/i);

    const supplierFromContribuinteLine = lines
        .slice(0, 20)
        .map((line) => line.match(/^(.+?)\s+\d{9}\s+Contribuinte\s*:/i)?.[1]?.trim() || '')
        .find(Boolean) || '';

    const headerSupplierLine = lines
        .slice(0, 12)
        .find((line) => /[A-ZÁÀÃÂÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]{4,}/.test(line) && !/NIF|N\.?\s*Contribuinte|Matr[ií]cula|Data/i.test(line));
    const supplierFromHeader = headerSupplierLine?.split('-')[0]?.trim() || '';

    const invoiceNumber = extractInvoiceNumber(lines, compact, file.name.replace(/\.pdf$/i, ''));

    const issueDate =
        findLabeledDate(lines, [/data\s*doc/i, /data\s*emiss[aã]o/i, /invoice\s*date/i, /issue\s*date/i, /data\s*fatura/i])
        || findOrderDateInCompactText(compact)
        || findOrderLineDate(lines)
        || (() => {
            for (const line of lines) {
                if (!/\bdata\b/i.test(line) || /venc/i.test(line)) continue;
                const m = line.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/);
                if (m?.[1]) {
                    const iso = toIsoDate(m[1]);
                    if (iso) return iso;
                }
            }
            return '';
        })();

    const dueDate = findLabeledDate(lines, [
        /data\s*venc/i,
        /due\s*date/i,
        /vencimento/i,
        /data\s*limite/i
    ]);

    const fallbackDateMatch = compact.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/);

    const summaryTotals = extractSummaryTotalsFromCompact(compact);

    const totalFromCompact = extractAmountAfterLabelInCompact(compact, [/total\s*:/i, /total\s*a\s*pagar/i, /total\s*final/i, /valor\s*total/i, /total\s*documento/i]);
    const vatFromCompact = extractAmountAfterLabelInCompact(compact, [/total\s*iva/i, /iva\s*total/i, /\biva\b/i]);

    const total = summaryTotals.total || totalFromCompact || findLabeledAmount(lines, [
        /total\s*a\s*pagar/i,
        /total\s*final/i,
        /valor\s*total/i,
        /total\s*documento/i,
        /^\s*total\b/i,
    ]);

    const vatTotal = summaryTotals.vat || vatFromCompact || findLabeledAmount(lines, [
        /iva\s*total/i,
        /total\s*iva/i,
        /^\s*iva\b/i,
    ]);

    const netFromSummary = summaryTotals.net;

    const vatRateMatch = compact.match(/(?:IVA|VAT)\s*[:\-]?\s*(6|13|23)(?:[.,]00)?\s*%?/i)
        || compact.match(/\b(6|13|23)[.,]00\b/);
    const vatPercent = clampVat(vatRateMatch ? Number(vatRateMatch[1]) : inferVatPercentFromTotals(total, vatTotal));
    const extractedLines = dedupeAndReconcileLines(
        extractDetailedLines(positionalRows, lines, total, vatTotal, vatPercent),
        total > 0 ? total : (netFromSummary > 0 ? Number((netFromSummary + vatTotal).toFixed(2)) : total),
        vatTotal,
        vatPercent
    );

    const mappedProducts: InvoiceImportExtractedProduct[] = extractedLines.map(line => ({
        description: line.description,
        qty: line.qty,
        unidade_medida: line.unidade_medida,
        unit_price: line.unit_price,
        discount_percentage: line.discount_percentage || 0,
        net_value: line.net_value || Number((line.qty * line.unit_price * (1 - (line.discount_percentage || 0) / 100)).toFixed(2)),
        vat_percent: line.vat_percent as 0 | 6 | 13 | 23,
        vat_value: line.vat_value || 0
    }));

    return {
        supplier: supplierMatch?.[1]?.trim() || supplierFromContribuinteLine || supplierFromHeader,
        invoice_number: invoiceNumber,
        invoice_date: issueDate || toIsoDate(fallbackDateMatch?.[1] || ''),
        date: issueDate || toIsoDate(fallbackDateMatch?.[1] || ''),
        due_date: dueDate || '',
        total_amount: total,
        total: total,
        vat_amount: vatTotal,
        vat_total: vatTotal,
        net_amount: netFromSummary > 0 ? netFromSummary : Math.max(0, total - vatTotal),
        supplier_vat: null,
        expense_description: null,
        suggested_category: null,
        vehicle_registrations: [],
        lines: mappedProducts,
        products: mappedProducts,
    };
}

const uploadToAvailableBucket = async (storagePath: string, file: File) => {
    let lastError: any = null;

    for (const bucket of IMPORT_BUCKETS) {
        const { error } = await supabase.storage
            .from(bucket)
            .upload(storagePath, file, { upsert: false, contentType: file.type || 'application/pdf' });

        if (!error) {
            return { bucket, storagePath };
        }

        lastError = error;
    }

    throw lastError || new Error('Unable to upload file to any supported bucket');
};

const createSignedUrlFromAvailableBucket = async (storagePath: string) => {
    let lastError: any = null;

    for (const bucket of IMPORT_BUCKETS) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 60 * 5);

        if (!error && data?.signedUrl) {
            return { bucket, signedUrl: data.signedUrl };
        }

        lastError = error;
    }

    throw lastError || new Error('Unable to generate signed URL for parsing');
};

const insertImportRowWithFallback = async (storagePath: string, extractedData?: any) => {
    const payload: Record<string, unknown> = {
        file_path: storagePath,
        storage_path: storagePath,
        status: extractedData ? 'ready' : 'processing',
        extracted_json: extractedData || null,
    };

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data, error } = await supabase
            .from('invoice_imports')
            .insert(payload)
            .select('*')
            .single();

        if (!error && data) return data;

        const missingColumn = getMissingColumn(error);
        if (!missingColumn || !(missingColumn in payload)) {
            throw error || new Error('Unable to create invoice import');
        }

        delete payload[missingColumn];
        if (missingColumn === 'file_path') {
            payload.storage_path = storagePath;
        }
    }

    throw new Error('Unable to create invoice import');
};

const updateImportRowWithFallback = async (importId: string, data: Record<string, unknown>) => {
    const payload = { ...data };

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { error } = await supabase
            .from('invoice_imports')
            .update(payload)
            .eq('id', importId);

        if (!error) return;

        const missingColumn = getMissingColumn(error);
        if (!missingColumn || !(missingColumn in payload)) {
            throw error;
        }

        delete payload[missingColumn];
    }

    throw new Error('Unable to update invoice import');
};

const invokeInvoiceParser = async (importId: string, signedUrl: string, mode: 'full' | 'mobile-summary' = 'full', fileName: string, ocrText?: string): Promise<string | null> => {
    const parseResult = await supabase.functions.invoke('parse-invoice', {
        body: {
            importId,
            fileUrl: signedUrl,
            mode,
            fileName,
            ocrText
        },
    });

    if (parseResult.data && parseResult.data.error) {
        const errObj = parseResult.data;
        return `OCR unavailable: [${errObj.step}] ${errObj.error}`;
    }

    if (parseResult.error) {
        return `OCR unavailable: ${parseResult.error.message || 'FunctionsHttpError'}`;
    }

    const fallbackResult = await supabase.functions.invoke('process-invoice-import', {
        body: {
            importId,
        },
    });

    if (!fallbackResult.error) return null;

    const parseErrorMessage = String((parseResult.error as any)?.message || parseResult.error || 'parse-invoice failed');
    const fallbackErrorMessage = String((fallbackResult.error as any)?.message || fallbackResult.error || 'process-invoice-import failed');
    
    let detailedError = parseErrorMessage;
    try {
        if (parseResult.error instanceof Error) detailedError = parseResult.error.message;
        const errObj = JSON.parse(detailedError);
        if (errObj.step) detailedError = `[${errObj.step}] ${errObj.error}`;
    } catch { /* ignore parse error */ }

    return `OCR unavailable: ${detailedError} | fallback: ${fallbackErrorMessage}`;
};

export async function createInvoiceImportFromPdf(file: File, extractedData?: any, mode: 'full' | 'mobile-summary' = 'full'): Promise<InvoiceImport> {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${randomToken()}.${fileExt}`;
    const storagePath = `raw/${fileName}`;

    await uploadToAvailableBucket(storagePath, file);

    const importRow = await insertImportRowWithFallback(storagePath, extractedData);

    const { signedUrl: originalSignedUrl } = await createSignedUrlFromAvailableBucket(resolveImportStoragePath(importRow));
    let ocrUrl = originalSignedUrl;

    let localOcrText = '';
    if (fileExt.toLowerCase() === 'pdf') {
        try {
            const lines = await extractPdfLines(file);
            localOcrText = lines.join('\n');
        } catch (e) {
            console.error('Failed to extract PDF text locally', e);
        }

        try {
            const rasterizedImage = await rasterizeFirstPageOfPdf(file);
            const imageExt = 'jpeg';
            const imageFileName = `${Date.now()}-${randomToken()}-ocr.${imageExt}`;
            const imageStoragePath = `raw/${imageFileName}`;
            
            await uploadToAvailableBucket(imageStoragePath, rasterizedImage);
            
            const { signedUrl: imageSignedUrl } = await createSignedUrlFromAvailableBucket(imageStoragePath);
            ocrUrl = imageSignedUrl;
        } catch (e) {
            console.error('Failed to rasterize PDF for OCR', e);
        }
    }

    const parserError = await invokeInvoiceParser(importRow.id, ocrUrl, mode, file.name, localOcrText);

    if (parserError) {
        try {
            await updateImportRowWithFallback(importRow.id, {
                status: extractedData ? ('ready' as InvoiceImportStatus) : ('failed' as InvoiceImportStatus),
                error: parserError,
                error_message: parserError,
                processed_at: new Date().toISOString(),
            });
        } catch {
            // ignore secondary update failures
        }

        return normalizeImportRow({
            ...importRow,
            status: extractedData ? 'ready' : 'failed',
            error: parserError,
            error_message: parserError,
        });
    }

    return normalizeImportRow(importRow);
}

export async function getInvoiceImport(importId: string): Promise<InvoiceImport> {
    const { data, error } = await supabase
        .from('invoice_imports')
        .select('*')
        .eq('id', importId)
        .single();

    if (error || !data) throw error || new Error('Invoice import not found');
    return normalizeImportRow(data);
}

export async function markInvoiceImportConfirmed(importId: string, supplierInvoiceId: string) {
    await updateImportRowWithFallback(importId, {
        status: 'confirmed' as InvoiceImportStatus,
        supplier_invoice_id: supplierInvoiceId,
        error: null,
        error_message: null,
        confirmed_at: new Date().toISOString(),
    });
}

export async function reparseInvoiceImport(importId: string, filePath: string) {
    const { signedUrl } = await createSignedUrlFromAvailableBucket(filePath);

    await updateImportRowWithFallback(importId, {
        status: 'processing' as InvoiceImportStatus,
        error: null,
        error_message: null,
        processed_at: null,
    });

    const fileName = filePath.split('/').pop() || '';
    const parserError = await invokeInvoiceParser(importId, signedUrl, 'full', fileName);
    if (parserError) {
        try {
            await updateImportRowWithFallback(importId, {
                status: 'failed' as InvoiceImportStatus,
                error: parserError,
                error_message: parserError,
                processed_at: new Date().toISOString(),
            });
        } catch {
            // ignore secondary update failures
        }
    }
}

export async function getInvoiceImportPreviewUrl(filePath: string): Promise<string | null> {
    if (!filePath) return null;

    for (const bucket of IMPORT_BUCKETS) {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 10);
        if (!error && data?.signedUrl) return data.signedUrl;
    }

    return null;
}

export async function getPendingInvoiceImports(): Promise<InvoiceImport[]> {
    const { data, error } = await supabase
        .from('invoice_imports')
        .select('*')
        .in('status', ['processing', 'ready', 'failed'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching pending imports:', error);
        return [];
    }
    
    return (data || []).map(normalizeImportRow);
}

export async function deleteInvoiceImport(importId: string): Promise<void> {
    const { error } = await supabase
        .from('invoice_imports')
        .delete()
        .eq('id', importId);

    if (error) {
        throw error;
    }
}
