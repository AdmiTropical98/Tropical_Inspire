import * as pdfjsLib from 'pdfjs-dist';
import type { InvoiceUnit } from '../../types';
import type { InvoiceEngineLine, InvoiceEngineTotals } from './types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function num(s: string): number {
  const x = String(s || '').replace(/\s/g, '');
  if (x.includes(',') && x.includes('.')) return Number(x.lastIndexOf(',') > x.lastIndexOf('.') ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, ''));
  if (x.includes(',')) return Number(x.replace(/\./g, '').replace(',', '.'));
  return Number(x);
}
const isoDate = (s: string) => {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const d = s.match(/(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  return d ? `${d[3]}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}` : '';
};
const linesOf = (s: string) => s.replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
const unit = (s: string): InvoiceUnit => {
  const u=s.toUpperCase();
  if (/^(H|HR|HRS|HOR|HORAS)$/.test(u)) return 'H';
  if (/^(L|LT|LTS)$/.test(u)) return 'L';
  if (/^(CX|CAIXA|CAIXAS)$/.test(u)) return 'CX';
  if (/^(KG|G|M|M2|M3|UN)$/.test(u)) return u as InvoiceUnit;
  return 'UN';
};

function nextDate(lines: string[], re: RegExp) {
  for (let i=0;i<lines.length;i++) {
    if (!re.test(lines[i])) continue;
    const same=lines[i].match(/\d{4}-\d{2}-\d{2}|\d{1,2}[/. -]\d{1,2}[/. -]\d{4}/);
    if (same) return isoDate(same[0]);
    for(let j=i+1;j<=Math.min(i+3,lines.length-1);j++) {
      const m=lines[j].match(/\d{4}-\d{2}-\d{2}|\d{1,2}[/. -]\d{1,2}[/. -]\d{4}/);
      if(m) return isoDate(m[0]);
    }
  }
  return '';
}

export function extractInvoiceHeader(text: string) {
  const lines=linesOf(text), source=lines.join('\n');
  const invoice =
    source.match(/\b(FT\s+FA\.?\s*\d{4}\/\d+)\b/i)?.[1] ||
    source.match(/\b(FTA\s*\d+\/\d+)\b/i)?.[1] ||
    source.match(/\b(FT\s*\d+\/\d+)\b/i)?.[1] || '';
  const nif=source.match(/(?:NIF|N\.?I\.?F\.?|CONTRIBUINTE)\s*:?\s*(\d{9})/i)?.[1] || '';
  const req=source.match(/(?:REQUISI[CÇ][AÃ]O)\s*:?\s*([A-Z]{1,5}\s*[/\-]\s*\d+)/i)?.[1]?.replace(/\s/g,'') ||
            source.match(/\b(R\d{2}\/\d{3,8})\b/i)?.[1] || '';
  const reg=source.match(/(?:MATR[IÍ]CULA|VIATURA)\s*:?\s*([A-Z0-9-]{5,10})/i)?.[1] || '';
  const chassis=source.match(/(?:CHASSIS|VIN)\s*:?\s*([A-Z0-9]{10,20})/i)?.[1] || '';
  const model=source.match(/(?:MODELO|VE[IÍ]CULO)\s*:?\s*([^\n]{3,80})/i)?.[1]?.trim() || '';
  return {
    invoiceNumber: invoice.trim(),
    issueDate: nextDate(lines, /(?:^|\s)DATA(?:\s|$)|EMISS[AÃ]O/i) || (source.match(/\d{4}-\d{2}-\d{2}/)?.[0] || ''),
    dueDate: nextDate(lines,/VENCIMENTO/i),
    supplierNif:nif, registration:reg, chassis, vehicleModel:model, requisitionNumber:req
  };
}

export function extractInvoiceLines(text: string): InvoiceEngineLine[] {
  const out: InvoiceEngineLine[]=[];
  for (let i=0;i<linesOf(text).length;i++) {
    const line=linesOf(text)[i];
    if (/^(artigo|descri[cç][aã]o|requisi[cç][aã]o|total|subtotal|iva|vencimento|pagamento|mercadoria|servi[cç]os|portes|acerto|original|carga|descarga)/i.test(line)) continue;
    const um=line.match(/\b(UN|UND|UNID|H|HR|HRS|HOR|L|LT|LTS|CX|KG|G|M2|M3|M)\b/i);
    if(!um || um.index===undefined) continue;
    const desc=line.slice(0,um.index).trim();
    const before=line.slice(0,um.index);
    const q=before.match(/(\d+(?:[.,]\d+)?)\s*$/);
    if(!desc || !q) continue;
    const quantity=num(q[1]);
    const tail=line.slice(um.index+um[0].length);
    const ns=[...tail.matchAll(/-?\d+(?:[.,]\d+)?/g)].map(m=>num(m[0]));
    if(ns.length<4) continue;
    const unitPrice=ns[0], discount=ns[1], vat=[0,6,13,23].includes(Math.round(ns[2]))?Math.round(ns[2]):23;
    const net=ns[3], iva=round2(net*vat/100);
    out.push({description:desc,unidade_medida:unit(um[0]),quantity:round2(quantity),unit_price:round2(unitPrice),discount_percentage:round2(discount),net_value:round2(net),iva_rate:vat as 0|6|13|23,iva_value:iva,total_value:round2(net+iva),source_row:i+1});
  }
  return out;
}

export function extractInvoiceTotals(text:string, lines:InvoiceEngineLine[]):InvoiceEngineTotals {
  const source=text.replace(/\s+/g,' ');
  const find=(re:RegExp)=>{const m=source.match(re);return m?.[1]?num(m[1]):0};
  const taxable=find(/(?:MERCADORIA\/SERVI[CÇ]OS|TOTAL\s+L[IÍ]QUIDO|TOTAL\s+SEM\s+IVA)\s*:?\s*([0-9.,]+)/i)||round2(lines.reduce((s,l)=>s+Number(l.net_value||0),0));
  const vat=find(/(?:TOTAL\s+IVA|IVA\s+A\s+PAGAR|IMPOSTO)\s*:?\s*([0-9.,]+)/i)||round2(lines.reduce((s,l)=>s+Number(l.iva_value||0),0));
  const total=find(/TOTAL\s*\(\s*EUR\s*\)\s*:?\s*([0-9.,]+)/i)||round2(taxable+vat);
  const gross=round2(lines.reduce((s,l)=>s+Number(l.quantity||0)*Number(l.unit_price||0),0));
  return {gross,discounts:round2(Math.max(0,gross-taxable)),taxable,vat,total};
}

export async function extractPdfText(file:File):Promise<string>{
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data,disableWorker:true,useWorkerFetch:false}).promise;
  const pages:string[]=[];
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);
    const content=await page.getTextContent();
    pages.push((content.items||[]).map((x:any)=>String(x.str||'')).filter(Boolean).join('\n'));
  }
  return pages.join('\n');
}
