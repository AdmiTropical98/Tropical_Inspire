import { extractInvoiceHeader, extractInvoiceLines, extractInvoiceTotals, extractPdfText } from './pdfTextParser';
import { matchCostCenter, matchRequisition, matchSupplier, matchVehicle } from './entityMatcher';
import type { InvoiceEngineInput, InvoiceEngineResult } from './types';

const level=(s:number)=>s>=90?'high':s>=70?'medium':'low';

export async function processInvoice(input:InvoiceEngineInput):Promise<InvoiceEngineResult>{
 const sourceText=await extractPdfText(input.file);
 const h=extractInvoiceHeader(sourceText);
 const lines=extractInvoiceLines(sourceText);
 const totals=extractInvoiceTotals(sourceText,lines);
 const supplier=matchSupplier(h.supplierNif,'',input.suppliers);
 const vehicle=matchVehicle(h.registration,h.chassis,h.vehicleModel,input.vehicles);
 const normalizedReq=String(h.requisitionNumber||'').replace(/\s+/g,'').toUpperCase();
 const exact=input.requisitions.find((r:any)=>[r.numero,r.number,r.codigo,r.referencia].filter(Boolean).some((v:any)=>String(v).replace(/\s+/g,'').toUpperCase()===normalizedReq));
 const requisition=exact?{entity:exact,score:100,reasons:['número de requisição exato']}:matchRequisition(supplier?.entity.id||'',vehicle?.entity.id||'',h.issueDate,input.requisitions);
 const costCenter=matchCostCenter(requisition?.entity||null,input.costCenters);
 const warnings:string[]=[];
 if(!h.invoiceNumber)warnings.push('Número da fatura não foi identificado.');
 if(!h.issueDate)warnings.push('Data de emissão não foi identificada.');
 if(!h.dueDate)warnings.push('Data de vencimento não foi identificada.');
 if(!supplier)warnings.push('Fornecedor não foi associado automaticamente.');
 if(!vehicle && !requisition)warnings.push('Viatura não foi associada automaticamente.');
 if(!requisition)warnings.push('Não foi encontrada uma requisição suficientemente compatível.');
 if(!costCenter)warnings.push('Centro de custo não foi associado automaticamente.');
 if(!lines.length)warnings.push('Nenhuma linha de faturação foi identificada.');
 if(totals.total<=0)warnings.push('Total da fatura não foi identificado.');
 return {
  invoice_number:{value:h.invoiceNumber||null,score:h.invoiceNumber?100:0,level:level(h.invoiceNumber?100:0) as any,source:'pdf'},
  issue_date:{value:h.issueDate||null,score:h.issueDate?100:0,level:level(h.issueDate?100:0) as any,source:'pdf'},
  due_date:{value:h.dueDate||null,score:h.dueDate?100:0,level:level(h.dueDate?100:0) as any,source:'pdf'},
  supplier,vehicle,requisition,cost_center:costCenter,lines,totals,warnings,source_text:sourceText,requisition_number:h.requisitionNumber||'',parser:'pdf-text-v3'
 };
}
export function toInvoiceDraft(r:InvoiceEngineResult){
 return {supplier_id:r.supplier?.entity.id||'',requisition_id:r.requisition?.entity.id||'',vehicle_id:r.vehicle?.entity.id||'',cost_center_id:r.cost_center?.entity.id||'',invoice_number:String(r.invoice_number.value||''),issue_date:String(r.issue_date.value||''),due_date:String(r.due_date.value||''),lines:r.lines,totals:r.totals,warnings:r.warnings};
}
export type { InvoiceEngineInput, InvoiceEngineResult, InvoiceEngineLine, InvoiceEngineTotals } from './types';
