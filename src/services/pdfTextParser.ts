import type { InvoiceUnit } from '../../types';
import type { InvoiceEngineLine, InvoiceEngineTotals } from './types';

const numberPattern = /-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|-?\d+(?:[.,]\d{1,4})?/g;

const parseNumber = (value: string): number => {
  const raw = String(value || '').trim().replace(/\s/g, '');
  if (!raw) return 0;
  if (raw.includes(',') && raw.includes('.')) {
    return raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw.replace(/,/g, ''));
  }
  if (raw.includes(',')) return Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number(raw);
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const unitMap: Record<string, InvoiceUnit> = {
  UN: 'UN',
  UND: 'UN',
  UNID: 'UN',
  UNIDADE: 'UN',
  H: 'H',
  HR: 'H',
  HRS: 'H',
  HOR: 'H',
  HORAS: 'H',
  L: 'L',
  LT: 'L',
  LTS: 'L',
  CX: 'CX',
  CAIXA: 'CX',
  KG: 'KG',
  G: 'G',
  M: 'M',
  M2: 'M2',
  M3: 'M3',
};

const normalizeUnit = (value: string): InvoiceUnit => unitMap[value.toUpperCase()] || 'UN';

const cleanText = (text: string) =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');

export function extractInvoiceHeader(text: string) {
  const source = cleanText(text);

  const invoicePatterns = [
    /(?:N[º°o.]?\s*(?:DA\s*)?FATURA|N[ÚU]MERO\s+DA\s+FATURA|DOCUMENTO)\s*[:#-]?\s*([A-Z]{0,8}\s*\d[\w./-]{2,40})/i,
    /\b(FTA\s*\d{3,12}\/\d{1,8})\b/i,
    /\b(FT\s*\d{3,12}\/\d{1,8})\b/i,
    /\b(F[A-Z]{1,5}\s*\d{4,12}\/\d{1,8})\b/i,
  ];

  let invoiceNumber = '';
  for (const pattern of invoicePatterns) {
    const match = source.match(pattern);
    const value = match?.[1]?.trim() || '';
    if (!value) continue;
    if (/^\d{2}-\d{4,}$/.test(value)) continue;
    invoiceNumber = value;
    break;
  }

  const dateMatches = [...source.matchAll(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/g)]
    .map(m => m[1])
    .filter(Boolean);

  const toIso = (value: string) => {
    const parts = value.split(/[/-]/).map(Number);
    if (parts.length !== 3) return '';
    const [d, m, y] = parts;
    if (d < 1 || d > 31 || m < 1 || m > 12) return '';
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const dueMatch = source.match(/(?:VENCIMENTO|VENCE|DATA\s+DE\s+VENCIMENTO)\s*[:\-]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i);
  const issueMatch = source.match(/(?:DATA\s+DE\s+EMISS[AÃ]O|EMISS[AÃ]O|DATA)\s*[:\-]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i);

  const nifMatch = source.match(/(?:NIF|N\.?I\.?F\.?|CONTRIBUINTE)\s*[:\-]?\s*(\d{9})/i);
  const registrationMatch = source.match(/(?:MATR[IÍ]CULA|VIATURA|REGISTO)\s*[:\-]?\s*([A-Z]{1,3}[- ]?\d{2}[- ]?[A-Z]{1,3}|\d{2}[- ]?[A-Z]{2}[- ]?\d{2})/i);
  const chassisMatch = source.match(/(?:CHASSIS|VIN|N[º°]?\s*CHASSIS)\s*[:\-]?\s*([A-Z0-9]{10,20})/i);
  const modelMatch = source.match(/(?:MODELO|VE[IÍ]CULO)\s*[:\-]?\s*([^\n]{3,80})/i);

  return {
    invoiceNumber,
    issueDate: toIso(issueMatch?.[1] || dateMatches[0] || ''),
    dueDate: toIso(dueMatch?.[1] || ''),
    supplierNif: nifMatch?.[1] || '',
    registration: registrationMatch?.[1] || '',
    chassis: chassisMatch?.[1] || '',
    vehicleModel: modelMatch?.[1]?.trim() || '',
  };
}

function parseLine(line: string, row: number): InvoiceEngineLine | null {
  const unitMatch = line.match(/\b(UN|UND|UNID|H|HR|HRS|HOR|HORAS|L|LT|LTS|CX|CAIXA|KG|G|M2|M3|M)\b/i);
  if (!unitMatch || unitMatch.index == null) return null;

  const left = line.slice(0, unitMatch.index).trim();
  const right = line.slice(unitMatch.index + unitMatch[0].length).trim();

  const leftNums = [...left.matchAll(numberPattern)].map(m => ({ value: parseNumber(m[0]), index: m.index ?? 0 }));
  if (!leftNums.length) return null;

  const quantity = leftNums[leftNums.length - 1].value;
  const description = left.slice(0, leftNums[leftNums.length - 1].index).trim();

  if (!description || description.length < 2) return null;
  if (/^(total|subtotal|iva|vencimento|pagamento|documento|fatura|cliente|fornecedor|nif)/i.test(description)) return null;

  const nums = [...right.matchAll(numberPattern)].map(m => parseNumber(m[0]));
  if (nums.length < 2) return null;

  const unitPrice = nums[0];
  let discount = 0;
  let net = round2(quantity * unitPrice);
  let vat = 23;

  if (nums.length >= 4) {
    discount = nums[1];
    net = nums[2];
    const possibleVat = nums[3];
    if ([0, 6, 13, 23].includes(Math.round(possibleVat))) vat = Math.round(possibleVat);
  } else if (nums.length === 3) {
    const possibleVat = nums[2];
    if ([0, 6, 13, 23].includes(Math.round(possibleVat))) {
      vat = Math.round(possibleVat);
      net = nums[1];
      discount = quantity * unitPrice > 0
        ? round2((1 - net / (quantity * unitPrice)) * 100)
        : 0;
    } else {
      discount = nums[1];
      net = nums[2];
    }
  } else {
    const tail = nums[1];
    if ([0, 6, 13, 23].includes(Math.round(tail))) {
      vat = Math.round(tail);
    } else {
      net = tail;
      discount = quantity * unitPrice > 0
        ? round2((1 - net / (quantity * unitPrice)) * 100)
        : 0;
    }
  }

  if (!(quantity > 0) || !(unitPrice >= 0) || !(net >= 0)) return null;

  const vatValue = round2(net * vat / 100);

  return {
    description: description.replace(/\s{2,}/g, ' ').trim(),
    unidade_medida: normalizeUnit(unitMatch[0]),
    quantity: round2(quantity),
    unit_price: round2(unitPrice),
    discount_percentage: Math.max(0, round2(discount)),
    net_value: round2(net),
    iva_rate: vat as 0 | 6 | 13 | 23,
    iva_value: vatValue,
    total_value: round2(net + vatValue),
    source_row: row,
  };
}

export function extractInvoiceLines(text: string): InvoiceEngineLine[] {
  const lines = cleanText(text).split('\n');
  const parsed: InvoiceEngineLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const item = parseLine(lines[i], i + 1);
    if (!item) continue;

    const duplicate = parsed.some(existing =>
      existing.description === item.description &&
      Math.abs(existing.net_value - item.net_value) < 0.01
    );
    if (!duplicate) parsed.push(item);
  }

  return parsed;
}

export function extractInvoiceTotals(text: string, lines: InvoiceEngineLine[]): InvoiceEngineTotals {
  const source = cleanText(text);
  const findAmount = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const m = source.match(pattern);
      if (m?.[1]) return round2(parseNumber(m[1]));
    }
    return 0;
  };

  const taxableFromLines = round2(lines.reduce((sum, l) => sum + Number(l.net_value || 0), 0));
  const vatFromLines = round2(lines.reduce((sum, l) => sum + Number(l.iva_value || 0), 0));

  const taxable = findAmount([
    /(?:TOTAL\s+L[IÍ]QUIDO|BASE\s+TRIBUT[AÁ]VEL|TOTAL\s+SEM\s+IVA)\s*[:\-]?\s*([0-9.,]+)/i,
  ]) || taxableFromLines;

  const vat = findAmount([
    /(?:TOTAL\s+IVA|IVA\s+A\s+PAGAR|IMPOSTO)\s*[:\-]?\s*([0-9.,]+)/i,
  ]) || vatFromLines;

  const total = findAmount([
    /(?:TOTAL\s+A\s+PAGAR|TOTAL\s+FINAL|TOTAL\s+COM\s+IVA|TOTAL)\s*[:\-]?\s*([0-9.,]+)\s*€?/i,
  ]) || round2(taxable + vat);

  const gross = round2(lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0));
  const discounts = round2(Math.max(0, gross - taxable));

  return { gross, discounts, taxable, vat, total };
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js não está disponível na aplicação.');

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = (content.items || [])
      .map((item: any) => String(item.str || ''))
      .filter(Boolean);
    pages.push(items.join('\n'));
  }

  return pages.join('\n');
}
