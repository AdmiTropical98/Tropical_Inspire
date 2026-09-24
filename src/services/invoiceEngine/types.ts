import type { CentroCusto, Fornecedor, Requisicao, SupplierInvoiceLine, Viatura } from '../../types';
export type InvoiceConfidenceLevel='high'|'medium'|'low';
export interface InvoiceFieldConfidence { value:string|number|null; score:number; level:InvoiceConfidenceLevel; source:'pdf'|'qr'|'ocr'|'derived'|'manual'; }
export interface InvoiceEngineLine extends SupplierInvoiceLine { source_row?:number; confidence?:number; }
export interface InvoiceEngineTotals { gross:number; discounts:number; taxable:number; vat:number; total:number; }
export interface InvoiceEngineCandidate<T>{entity:T;score:number;reasons:string[];}
export interface InvoiceEngineInput{file:File;suppliers:Fornecedor[];vehicles:Viatura[];costCenters:CentroCusto[];requisitions:Requisicao[];qrData?:any|null;}
export interface InvoiceEngineResult{
 invoice_number:InvoiceFieldConfidence; issue_date:InvoiceFieldConfidence; due_date:InvoiceFieldConfidence;
 supplier:InvoiceEngineCandidate<Fornecedor>|null; vehicle:InvoiceEngineCandidate<Viatura>|null;
 requisition:InvoiceEngineCandidate<Requisicao>|null; cost_center:InvoiceEngineCandidate<CentroCusto>|null;
 lines:InvoiceEngineLine[]; totals:InvoiceEngineTotals; warnings:string[]; source_text:string;
 requisition_number?:string; parser:'pdf-text-v3';
}
