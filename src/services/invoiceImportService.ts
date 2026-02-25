import { supabase } from '../lib/supabase';
import type { InvoiceImport, InvoiceImportStatus } from '../types';
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

const extractPdfRowsByGeometry = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true } as any).promise;
    const rows: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const entries = (content.items as any[])
            .map((item) => ({
                text: String(item?.str || '').trim(),
                x: Number(item?.transform?.[4] || 0),
                y: Number(item?.transform?.[5] || 0),
            }))
            .filter((item) => item.text);

        const groups: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
        for (const entry of entries) {
            const group = groups.find((candidate) => Math.abs(candidate.y - entry.y) <= 2.5);
            if (group) {
                group.items.push({ text: entry.text, x: entry.x });
            } else {
                groups.push({ y: entry.y, items: [{ text: entry.text, x: entry.x }] });
            }
        }

        groups
            .sort((a, b) => b.y - a.y)
            .forEach((group) => {
                const row = group.items
                    .sort((a, b) => a.x - b.x)
                    .map((item) => item.text)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (row) rows.push(row);
            });
    }

    return rows;
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

const lineNet = (line: { qty: number; unit_price: number }) => Number((line.qty * line.unit_price).toFixed(2));

const dedupeAndReconcileLines = (
    lines: Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }>,
    total: number,
    vatTotal: number,
    fallbackVatPercent: 0 | 6 | 13 | 23
): Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> => {
    if (!lines.length) return [];

    const seen = new Set<string>();
    const deduped = lines.filter((line) => {
        const key = [
            line.description.toLowerCase().replace(/\s+/g, ' ').trim(),
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

    const sumNet = Number(deduped.reduce((sum, line) => sum + lineNet(line), 0).toFixed(2));

    let selected = deduped;
    if (sumNet > targetNet * 1.12) {
        selected = [];
        let running = 0;

        for (const line of deduped) {
            const next = Number((running + lineNet(line)).toFixed(2));
            if (next <= targetNet * 1.03 || running < targetNet * 0.85) {
                selected.push(line);
                running = next;
            }
        }

        if (!selected.length) selected = deduped;
    }

    const selectedNet = Number(selected.reduce((sum, line) => sum + lineNet(line), 0).toFixed(2));
    const selectedVat = Number(selected.reduce((sum, line) => sum + Number(line.vat_value || Number((lineNet(line) * (line.vat_percent / 100)).toFixed(2))), 0).toFixed(2));

    const diffNet = Number((targetNet - selectedNet).toFixed(2));
    const diffVat = Number((vatTotal - selectedVat).toFixed(2));

    if (Math.abs(diffNet) > 0.02 || Math.abs(diffVat) > 0.02) {
        if (selected.length > 0 && lineNet(selected[0]) > 0) {
            const first = selected[0];
            const adjustedNet = Number((lineNet(first) + diffNet).toFixed(2));
            const adjustedQty = first.qty || 1;
            if (adjustedNet > 0) {
                first.unit_price = Number((adjustedNet / adjustedQty).toFixed(2));
                first.vat_value = Number((Number(first.vat_value || 0) + diffVat).toFixed(2));
            }
        } else if (targetNet > 0) {
            selected = [{
                description: 'Total da fatura',
                qty: 1,
                unit_price: targetNet,
                vat_percent: fallbackVatPercent,
                vat_value: vatTotal,
            }];
        }
    }

    return selected;
};

const extractDetailedLines = (
    lines: string[],
    compact: string,
    total: number,
    vatTotal: number,
    fallbackVatPercent: 0 | 6 | 13 | 23
): Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> => {
    const rowParsed: Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> = [];
    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+/g, ' ').trim();
        if (!line) continue;
        if (/opera[çc][aã]o\/pe[çc]a|descri[çc][aã]o\s+qtd|total\s+materiais|resumo\s+do\s+iva|descri[çc][aã]o\s+de\s+trabalhos|transport[ea]/i.test(line)) continue;

        const qtyTokenMatch = line.match(/(\d+[.,]\d+)\s+UN\b/i);
        if (!qtyTokenMatch?.[1]) continue;

        const qtyIndex = line.indexOf(qtyTokenMatch[1]);
        if (qtyIndex <= 0) continue;

        const left = line.slice(0, qtyIndex).trim();
        const right = line.slice(qtyIndex).trim();

        const rightNumbers = [...right.matchAll(/(\d+[.,]\d+)/g)].map((m) => toNumber(m[1]));
        if (rightNumbers.length < 4) continue;

        const qty = toNumber(qtyTokenMatch[1]);
        const unitPrice = rightNumbers[1] || 0;
        const vatPercent = clampVat(rightNumbers[rightNumbers.length - 1]) || fallbackVatPercent;
        const netValue = rightNumbers[rightNumbers.length - 2] || 0;

        const leftTokens = left.split(/\s+/);
        const description = leftTokens
            .filter((token, index) => !(index === 0 && /^\d+$/.test(token)) && !(index === 1 && /\d/.test(token) && token.length >= 4))
            .join(' ')
            .trim();

        if (!description || qty <= 0 || unitPrice <= 0 || netValue <= 0) continue;

        rowParsed.push({
            description,
            qty,
            unit_price: unitPrice,
            vat_percent: vatPercent,
            vat_value: Number((netValue * (vatPercent / 100)).toFixed(2)),
        });
    }

    if (rowParsed.length > 0) {
        return rowParsed;
    }

    const compactParsed: Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> = [];
    const blockStart = compact.search(/opera[çc][aã]o\/pe[çc]a|descri[çc][aã]o\s+qtd|v\.?\s*liquido|%iva/i);
    const blockEndCandidate = compact.search(/total\s+materiais|total\s+il[ií]quido|resumo\s+do\s+iva|descri[çc][aã]o\s+de\s+trabalhos/i);
    const blockText = blockStart >= 0
        ? compact.slice(blockStart, blockEndCandidate > blockStart ? blockEndCandidate : undefined)
        : compact;

    const rowRegex = /([A-Z0-9.\/-]{3,})\s+(.+?)\s+(\d+[.,]\d+)\s+UN\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(blockText)) !== null) {
        const code = match[1] || '';
        if (!/\d/.test(code)) continue;

        const description = (match[2] || '').replace(/\s+/g, ' ').trim();
        const qty = toNumber(match[3]);
        const unitPrice = toNumber(match[4]);
        const netValue = toNumber(match[6]);
        const vatPercent = clampVat(toNumber(match[7])) || fallbackVatPercent;

        if (!description || qty <= 0 || unitPrice <= 0 || netValue <= 0) continue;

        compactParsed.push({
            description,
            qty,
            unit_price: unitPrice,
            vat_percent: vatPercent,
            vat_value: Number((netValue * (vatPercent / 100)).toFixed(2)),
        });
    }

    if (compactParsed.length >= 2) {
        return compactParsed;
    }

    const twoLineParsed: Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> = [];
    let pendingDescription = '';

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+/g, ' ').trim();
        if (!line) continue;
        if (/total\s+materiais|total\s+il[ií]quido|resumo\s+do\s+iva|descri[çc][aã]o\s+de\s+trabalhos/i.test(line)) continue;

        const numericOnly = line.match(/^(\d+[.,]\d+)\s+UN\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)$/i);
        if (numericOnly && pendingDescription) {
            const qty = toNumber(numericOnly[1]);
            const unitPrice = toNumber(numericOnly[2]);
            const netValue = toNumber(numericOnly[4]);
            const vatPercent = clampVat(toNumber(numericOnly[5])) || fallbackVatPercent;

            if (qty > 0 && unitPrice > 0 && netValue > 0) {
                twoLineParsed.push({
                    description: pendingDescription,
                    qty,
                    unit_price: unitPrice,
                    vat_percent: vatPercent,
                    vat_value: Number((netValue * (vatPercent / 100)).toFixed(2)),
                });
            }

            pendingDescription = '';
            continue;
        }

        const looksLikeDescription = /[A-Za-zÁÀÃÂÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/i.test(line) && !/\bUN\b/i.test(line);
        if (looksLikeDescription) {
            const tokens = line.split(/\s+/);
            const cleaned = tokens
                .filter((token, index) => {
                    if (index === 0 && /^\d+$/.test(token)) return false;
                    if (index <= 1 && /^[A-Z0-9.\-/]{4,}$/.test(token) && /\d/.test(token)) return false;
                    return true;
                })
                .join(' ')
                .trim();

            if (cleaned && !/^(arm|opera[çc][aã]o\/pe[çc]a|descri[çc][aã]o)$/i.test(cleaned)) {
                pendingDescription = cleaned;
            }
        }
    }

    if (twoLineParsed.length > 0) {
        return twoLineParsed;
    }

    const byRegex: Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> = [];

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+/g, ' ').trim();
        if (!line) continue;
        if (/total\s+materiais|total\s+il[ií]quido|resumo\s+do\s+iva|descri[çc][aã]o\s+de\s+trabalhos/i.test(line)) continue;

        const match = line.match(/(.*)\s+(\d+[.,]\d+)\s+UN\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)$/i);
        if (!match) continue;

        const leftPart = match[1].trim();
        const qty = toNumber(match[2]);
        const unitPrice = toNumber(match[3]);
        const netValue = toNumber(match[5]);
        const vatPercent = clampVat(toNumber(match[6])) || fallbackVatPercent;

        if (qty <= 0 || unitPrice <= 0 || netValue <= 0) continue;

        const leftTokens = leftPart.split(/\s+/);
        const description = leftTokens.slice(2).join(' ').trim() || leftTokens.slice(1).join(' ').trim() || leftPart;
        if (!description) continue;

        byRegex.push({
            description,
            qty,
            unit_price: unitPrice,
            vat_percent: vatPercent,
            vat_value: Number((netValue * (vatPercent / 100)).toFixed(2)),
        });
    }

    if (byRegex.length > 0) {
        return byRegex;
    }

    const startIndex = lines.findIndex((line) => /opera[çc][aã]o\/pe[çc]a|descri[çc][aã]o\s+qtd|v\.?\s*liquido|%iva/i.test(line));
    const endIndexRaw = lines.findIndex((line, index) => index > (startIndex >= 0 ? startIndex : 0) && /total\s+materiais|total\s+il[ií]quido|resumo\s+do\s+iva/i.test(line));
    const endIndex = endIndexRaw >= 0 ? endIndexRaw : lines.length;

    const region = lines.slice(startIndex >= 0 ? startIndex + 1 : 0, endIndex);
    const parsed: Array<{ description: string; qty: number; unit_price: number; vat_percent: 0 | 6 | 13 | 23; vat_value?: number }> = [];

    for (const line of region) {
        if (/^\s*(total|transporte|desconto|arm|opera[çc][aã]o)/i.test(line)) continue;

        const tokens = line.trim().split(/\s+/);
        if (tokens.length < 8) continue;

        const qtyIndex = tokens.findIndex((token, index) =>
            /^\d+[.,]\d+$/.test(token) && index + 2 < tokens.length && /^[A-Za-z]{1,4}$/.test(tokens[index + 1])
        );

        if (qtyIndex < 0) continue;

        const numericTail = tokens.slice(qtyIndex + 2).filter((token) => /^\d+[.,]\d+$/.test(token));
        if (numericTail.length < 3) continue;

        const qty = toNumber(tokens[qtyIndex]);
        const unitPrice = toNumber(numericTail[0]);
        const vatPercent = clampVat(toNumber(numericTail[numericTail.length - 1])) || fallbackVatPercent;
        const netValue = toNumber(numericTail[numericTail.length - 2]);

        const descriptionStart = 2;
        const descriptionTokens = tokens.slice(descriptionStart, qtyIndex);
        const description = descriptionTokens.join(' ').trim();

        if (!description || qty <= 0 || unitPrice <= 0 || netValue <= 0) continue;

        const vatValue = Number((netValue * (vatPercent / 100)).toFixed(2));
        parsed.push({
            description,
            qty,
            unit_price: unitPrice,
            vat_percent: vatPercent,
            vat_value: vatValue,
        });
    }

    if (parsed.length === 0) {
        const inferredNet = total > 0 ? Math.max(0, Number((total - vatTotal).toFixed(2))) : 0;
        if (inferredNet > 0) {
            return [{
                description: 'Total da fatura',
                qty: 1,
                unit_price: inferredNet,
                vat_percent: fallbackVatPercent,
                vat_value: vatTotal,
            }];
        }
        return [];
    }

    return parsed;
};

export async function parseInvoicePdfLocally(file: File): Promise<InvoiceImportExtractedData> {
    const geometryLines = await extractPdfRowsByGeometry(file);
    const textLines = await extractPdfLines(file);
    const lines = geometryLines.length ? geometryLines : textLines;
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
        extractDetailedLines(lines, compact, total, vatTotal, vatPercent),
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
