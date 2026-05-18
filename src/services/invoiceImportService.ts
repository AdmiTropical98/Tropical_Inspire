import { supabase } from '../lib/supabase';
import type { InvoiceImport, InvoiceImportStatus, InvoiceUnit } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import type { InvoiceImportExtractedData } from '../types';

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

const toNumber = (value: string): number => {
    const normalized = value
        .replace(/\s/g, '')
        .replace(/€/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return new Date().toISOString().split('T')[0];

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const match = trimmed.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
};

const findLabeledDate = (lines: string[], labelRegexes: RegExp[]): string => {
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!labelRegexes.some((regex) => regex.test(line))) continue;

        const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{4})/);
        if (dateMatch?.[1]) return toIsoDate(dateMatch[1]);
    }

    return '';
};

const findOrderLineDate = (lines: string[]): string => {
    for (const line of lines) {
        if (!/ordof|o\.r\.|or\/?of/i.test(line)) continue;
        const dateMatch = line.match(/(\d{2}[\/.-]\d{2}[\/.-]\d{4}|\d{4}-\d{2}-\d{2})/i);
        if (dateMatch?.[1]) return toIsoDate(dateMatch[1]);
    }

    return '';
};

const findOrderDateInCompactText = (compact: string): string => {
    const match = compact.match(/ordof\s*\/?\s*[a-z0-9\/-]+\s+(\d{2}[\/.\-]\d{2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2})/i)
        || compact.match(/o\.r\.\s*\/?\s*[a-z0-9\/-]+\s+(\d{2}[\/.\-]\d{2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2})/i);

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

const extractPdfLines = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true } as any).promise;

    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        let currentLine = '';
        for (const item of content.items as any[]) {
            const chunk = String(item?.str || '').trim();
            if (chunk) currentLine = `${currentLine} ${chunk}`.trim();

            if (item?.hasEOL && currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
        }

        if (currentLine) lines.push(currentLine);
    }

    return lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

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

            // Aggressive Splitter: Split on 2+ spaces OR space between number and unit/price
            // This handles "53,50 HOR 41,50" or "80,00 23,00 0,00"
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
                // Increased tolerance to 5.5 to group slightly offset blocks
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
        // Correctly escaped numeric pattern for currency values
        const match = compact.match(new RegExp(`${regex.source}[^\\d]{0,20}(\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d{2})|\\d+(?:[.,]\\d{2}))`, 'i'));
        if (match?.[1]) {
            const value = toNumber(match[1]);
            if (value > 0) return value;
        }
    }
    return 0;
};

const extractSummaryTotalsFromCompact = (compact: string): { net: number; vat: number; total: number } => {
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
    ]);

    const vat = get([
        /total\s+iva\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
        /\biva\b\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
    ]);

    const total = get([
        /\btotal\b\s*[:\-]?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i,
    ]);

    return { net, vat, total };
};

const extractInvoiceNumber = (lines: string[], compact: string, fallbackName: string): string => {
    for (const line of lines) {
        if (!/fatura|factura|invoice/i.test(line)) continue;

        const prefixed = line.match(/\b([A-Z]{1,5}\s*\d{3,}(?:\/\d+)?)\b/i);
        if (prefixed?.[1]) return prefixed[1].replace(/\s+/g, ' ').trim().toUpperCase();

        const trailing = line.match(/fatura\s*[:#\-]?\s*([A-Z0-9\/-]{3,40})/i);
        if (trailing?.[1] && /[A-Z]/i.test(trailing[1])) {
            return trailing[1].replace(/\s+/g, ' ').trim().toUpperCase();
        }
    }

    const compactPrefixed = compact.match(/\b(FTA\s*\d{3,}(?:\/\d+)?)\b/i)
        || compact.match(/\b([A-Z]{2,5}\s*\d{3,}(?:\/\d+)?)\b/i);
    if (compactPrefixed?.[1]) return compactPrefixed[1].replace(/\s+/g, ' ').trim().toUpperCase();

    return fallbackName;
};

const inferVatPercentFromTotals = (total: number, vatTotal: number): 0 | 6 | 13 | 23 => {
    if (total <= 0 || vatTotal <= 0 || vatTotal >= total) return 0;

    const net = total - vatTotal;
    const inferred = (vatTotal / net) * 100;
    const candidates: Array<0 | 6 | 13 | 23> = [6, 13, 23, 0];

    let best: 0 | 6 | 13 | 23 = 0;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
        const diff = Math.abs(candidate - inferred);
        if (diff < bestDiff) {
            best = candidate;
            bestDiff = diff;
        }
    }

    return bestDiff <= 2 ? best : 0;
};

type ParsedInvoiceLine = {
    description: string;
    unidade_medida: InvoiceUnit;
    qty: number;
    unit_price: number;
    vat_percent: 0 | 6 | 13 | 23;
    vat_value?: number;
};


const NUMBER_TOKEN_SOURCE = '(?:\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
const NUMBER_TOKEN_REGEX = new RegExp(`^${NUMBER_TOKEN_SOURCE}$`);
const NON_ITEM_LINE_REGEX = /(iban|swift|bic|nib|entidade|refer[êe]ncia|multibanco|pagamento|dados\s+banc[aá]rios|transfer[êe]ncia|vencimento|total\s+a\s+pagar|subtotal|resumo\s+do\s+iva|resumos?|a\s+transportar|original|duplicado|triplicado|segunda\s*via|valor\s*il[ií]quido|totais(?:\s+servi[çc]os\s+internos)?|transporte|continua|eticadata|software|observa[çc][oõ]es|condi[çc][oõ]es|página|descri[çc][aã]o\s+de\s+trabalhos)/i;
const TABLE_START_REGEX = /arm\s+opera[çc][aã]o\/?pe[çc]a\s+descri[çc][aã]o\s+qtd\.?\s*un/i;
const TABLE_END_REGEX = /resumo\s+do\s+iva|total\s+i?l[ií]quido|total\s+documento|totais(?:\s+servi[çc]os\s+internos)?|descri[çc][aã]o\s+de\s+trabalhos/i;
const TABLE_CONTINUE_MARKER_REGEX = /a\s+transportar|totais(?:\s+servi[çc]os\s+internos)?|transporte|continua|v\.?\s*liquido|liquido|v\.?\s*mercadoria|mercadoria/i;
const SECTION_MARKER_REGEX = /^\s*(duplicado|triplicado|segunda\s*via)\b/i;
const UNIT_ANCHOR_REGEX = /^(UN|UND|UNID|UNIDADE|UNIDADES|UNI|HOR|H|HR|HRS|HORA|HORAS|L|LT|LTS|LITRO|LITROS|CX|CAIXA|CAIXAS|MT|MTS|METRO|METROS)$/i;

const normalizeTokenForMatch = (token: string): string => token
    .replace(/[|;,]/g, ' ')
    .replace(/[()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isNumericToken = (token: string): boolean => NUMBER_TOKEN_REGEX.test(normalizeTokenForMatch(token));

const isAnchorUnitToken = (token: string): boolean => UNIT_ANCHOR_REGEX.test(normalizeTokenForMatch(token).toUpperCase());

const findFirstUnitAnchorIndex = (tokens: string[]): number => tokens.findIndex((token) => isAnchorUnitToken(token));

const normalizeAnchorUnitToInvoiceUnit = (token: string): InvoiceUnit | '' => {
    const normalized = normalizeTokenForMatch(token).toUpperCase();
    if (!normalized) return '';

    if (['MT', 'MTS', 'METRO', 'METROS'].includes(normalized)) return 'UN';
    return normalizeUnitToken(normalized);
};
const normalizeUnitToken = (token?: string): InvoiceUnit | '' => {
    const value = (token || '').trim().toUpperCase();
    if (!value) return '';

    if (['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES', 'UNI'].includes(value)) return 'UN';
    if (['H', 'HR', 'HRS', 'HORA', 'HORAS', 'HOF', 'HOR', 'HO'].includes(value)) return 'H';
    if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(value)) return 'L';
    if (['CX', 'CAIXA', 'CAIXAS'].includes(value)) return 'CX';
    if (/m[aã]o\s*obra|mao\s*(de\s*)?obra|labor|serralharia|mecanica|mec[aâ]nica/i.test(value)) return 'H';

    // Strict restriction: only return valid units or empty
    return '';
};

const getScopedTableLines = (rows: PositionalRow[]): PositionalRow[] => {
    const startIndex = rows.findIndex((row) => TABLE_START_REGEX.test(row.items.map(i => i.text).join(' ')));
    if (startIndex < 0) return [];

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
    total: number,
    vatTotal: number,
    _fallbackVatPercent: 0 | 6 | 13 | 23
): ParsedInvoiceLine[] => {
    if (!lines.length) return [];

    const seen = new Set<string>();
    const deduped = lines.filter((line) => {
        const key = [
            line.description.toLowerCase().replace(/\s+/g, ' ').trim(),
            line.unidade_medida,
            line.qty.toFixed(2),
            line.unit_price.toFixed(2),
            line.vat_percent,
            Number(line.vat_value || 0).toFixed(2),
        ].join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const targetNet = total > 0 ? Number((total - vatTotal).toFixed(2)) : 0;
    if (targetNet <= 0) return deduped;
    return deduped;
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
        // Fallback to text based parsing if geometry fails
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
        const unitIndex = findFirstUnitAnchorIndex(tokenTexts);

        if (unitIndex > 0) {
            const qtyToken = tokenTexts[unitIndex - 1];
            const qty = isNumericToken(qtyToken) ? toNumber(qtyToken) : 0;
            const unitToken = normalizeAnchorUnitToInvoiceUnit(tokenTexts[unitIndex]);

            const numbersAfterUnit = tokenTexts
                .slice(unitIndex + 1)
                .filter((token) => isNumericToken(token))
                .map((token) => toNumber(token));

            const unitPrice = numbersAfterUnit[0] || 0;
            if (qty > 0 && unitToken && unitPrice > 0) {
                const rowDescription = tokenTexts.slice(0, unitIndex - 1).join(' ').replace(/\s+/g, ' ').trim();
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

                const subtotalCandidate = numbersAfterUnit.length >= 3 ? numbersAfterUnit[numbersAfterUnit.length - 2] : 0;
                const subtotal = subtotalCandidate > 0 ? subtotalCandidate : Number((qty * unitPrice).toFixed(2));

                if (fullDescription && !NON_ITEM_LINE_REGEX.test(fullDescription)) {
                    currentLine = {
                        description: fullDescription,
                        unidade_medida: unitToken,
                        qty,
                        unit_price: unitPrice,
                        vat_percent: vatPercent,
                        vat_value: Number((subtotal * (vatPercent / 100)).toFixed(2))
                    };
                    parsed.push(currentLine);
                    continue;
                }
            }
        }

        // Buffer/Continuation logic:
        // 1. If we have a current item, check if this line is purely text (no numeric clusters)
        // 2. If it is purely numeric noise (like totals/iva row), discard
        // 3. Otherwise, if it's mostly text, either continue description or add to pre-buffer
        const numberTokens = tokenTexts.filter((token) => isNumericToken(token));
        const textTokens = tokenTexts.filter((token) => !isNumericToken(token));

        // Majority Numeric Filter: if more numbers than text tokens, it's likely a footer/total line we missed
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
        const unitPriceToken = tokens.slice(unitIndex + 1).find((token) => isNumericToken(token));
        const unitPrice = unitPriceToken ? toNumber(unitPriceToken) : 0;
        const description = tokens.slice(0, unitIndex - 1).join(' ').replace(/\s+/g, ' ').trim();

        if (description && qty > 0 && unitMeasure && unitPrice > 0) {
            const netValue = Number((qty * unitPrice).toFixed(2));
            parsed.push({
                description,
                unidade_medida: unitMeasure,
                qty,
                unit_price: unitPrice,
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
    const headerSupplierLine = lines
        .slice(0, 12)
        .find((line) => /[A-ZÁÀÃÂÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]{4,}/.test(line) && !/NIF|N\.?\s*Contribuinte|Matr[ií]cula|Data/i.test(line));
    const supplierFromHeader = headerSupplierLine?.split('-')[0]?.trim() || '';

    const invoiceNumber = extractInvoiceNumber(lines, compact, file.name.replace(/\.pdf$/i, ''));

    const issueDate =
        findLabeledDate(lines, [/data\s*doc/i, /data\s*emiss[aã]o/i, /invoice\s*date/i, /issue\s*date/i])
        || findOrderDateInCompactText(compact)
        || findOrderLineDate(lines);
    const fallbackDateMatch = compact.match(/(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{4})/);

    const summaryTotals = extractSummaryTotalsFromCompact(compact);

    const totalFromCompact = extractAmountAfterLabelInCompact(compact, [/total\s*:/i, /total\s*a\s*pagar/i, /total\s*final/i, /valor\s*total/i]);
    const vatFromCompact = extractAmountAfterLabelInCompact(compact, [/total\s*iva/i, /iva\s*total/i, /\biva\b/i]);

    const total = summaryTotals.total || totalFromCompact || findLabeledAmount(lines, [
        /total\s*a\s*pagar/i,
        /total\s*final/i,
        /valor\s*total/i,
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

    return {
        supplier: supplierMatch?.[1]?.trim() || supplierFromHeader,
        invoice_number: invoiceNumber,
        date: issueDate || toIsoDate(fallbackDateMatch?.[1] || ''),
        total,
        vat_total: vatTotal,
        lines: extractedLines,
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

const insertImportRowWithFallback = async (storagePath: string) => {
    const payload: Record<string, unknown> = {
        file_path: storagePath,
        status: 'processing',
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

const invokeInvoiceParser = async (importId: string, signedUrl: string): Promise<string | null> => {
    const parseResult = await supabase.functions.invoke('parse-invoice', {
        body: {
            importId,
            fileUrl: signedUrl,
        },
    });

    if (!parseResult.error) return null;

    const fallbackResult = await supabase.functions.invoke('process-invoice-import', {
        body: {
            importId,
        },
    });

    if (!fallbackResult.error) return null;

    const parseErrorMessage = String((parseResult.error as any)?.message || parseResult.error || 'parse-invoice failed');
    const fallbackErrorMessage = String((fallbackResult.error as any)?.message || fallbackResult.error || 'process-invoice-import failed');
    return `OCR unavailable: ${parseErrorMessage} | fallback: ${fallbackErrorMessage}`;
};

export async function createInvoiceImportFromPdf(file: File): Promise<InvoiceImport> {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${randomToken()}.${fileExt}`;
    const storagePath = `raw/${fileName}`;

    await uploadToAvailableBucket(storagePath, file);

    const importRow = await insertImportRowWithFallback(storagePath);

    const { signedUrl } = await createSignedUrlFromAvailableBucket(resolveImportStoragePath(importRow));

    const parserError = await invokeInvoiceParser(importRow.id, signedUrl);

    if (parserError) {
        try {
            await updateImportRowWithFallback(importRow.id, {
                status: 'failed' as InvoiceImportStatus,
                error: parserError,
                error_message: parserError,
                processed_at: new Date().toISOString(),
            });
        } catch {
            // ignore secondary update failures
        }

        return normalizeImportRow({
            ...importRow,
            status: 'failed',
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

    const parserError = await invokeInvoiceParser(importId, signedUrl);
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
