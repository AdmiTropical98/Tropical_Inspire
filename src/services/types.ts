import type {
  CentroCusto,
  Fornecedor,
  Requisicao,
  SupplierInvoiceLine,
  Viatura,
} from '../../types';

export type InvoiceConfidenceLevel = 'high' | 'medium' | 'low';

export interface InvoiceFieldConfidence {
  value: string | number | null;
  score: number;
  level: InvoiceConfidenceLevel;
  source: 'pdf' | 'qr' | 'ocr' | 'derived' | 'manual';
}

export interface InvoiceEngineLine extends SupplierInvoiceLine {
  source_row?: number;
  confidence?: number;
}

export interface InvoiceEngineTotals {
  gross: number;
  discounts: number;
  taxable: number;
  vat: number;
  total: number;
}

export interface InvoiceEngineCandidate<T> {
  entity: T;
  score: number;
  reasons: string[];
}

export interface InvoiceEngineInput {
  file: File;
  suppliers: Fornecedor[];
  vehicles: Viatura[];
  costCenters: CentroCusto[];
  requisitions: Requisicao[];
  qrData?: {
    nif_emissor?: string;
    numero_fatura?: string;
    data_fatura?: string;
    total_com_impostos?: number;
    total_impostos?: number;
  } | null;
}

export interface InvoiceEngineResult {
  invoice_number: InvoiceFieldConfidence;
  issue_date: InvoiceFieldConfidence;
  due_date: InvoiceFieldConfidence;
  supplier: InvoiceEngineCandidate<Fornecedor> | null;
  vehicle: InvoiceEngineCandidate<Viatura> | null;
  requisition: InvoiceEngineCandidate<Requisicao> | null;
  cost_center: InvoiceEngineCandidate<CentroCusto> | null;
  lines: InvoiceEngineLine[];
  totals: InvoiceEngineTotals;
  warnings: string[];
  source_text: string;
  parser: 'pdf-text-v2';
}

export interface InvoiceDraft {
  supplier_id: string;
  requisition_id: string;
  vehicle_id: string;
  cost_center_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  lines: InvoiceEngineLine[];
  totals: InvoiceEngineTotals;
  warnings: string[];
}
