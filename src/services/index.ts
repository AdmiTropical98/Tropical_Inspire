import type { InvoiceEngineInput, InvoiceEngineResult } from './types';
import { extractInvoiceHeader, extractInvoiceLines, extractInvoiceTotals, extractPdfText } from './pdfTextParser';
import { matchCostCenter, matchRequisition, matchSupplier, matchVehicle } from './entityMatcher';

const confidenceLevel = (score: number) => {
  if (score >= 90) return 'high' as const;
  if (score >= 70) return 'medium' as const;
  return 'low' as const;
};

export async function processInvoice(input: InvoiceEngineInput): Promise<InvoiceEngineResult> {
  const sourceText = await extractPdfText(input.file);
  const header = extractInvoiceHeader(sourceText);
  const lines = extractInvoiceLines(sourceText);
  const totals = extractInvoiceTotals(sourceText, lines);

  const qr = input.qrData || null;

  if (qr?.numero_fatura && (!header.invoiceNumber || header.invoiceNumber !== qr.numero_fatura)) {
    header.invoiceNumber = qr.numero_fatura;
  }
  if (qr?.data_fatura) header.issueDate = qr.data_fatura;
  if (qr?.nif_emissor) header.supplierNif = qr.nif_emissor;

  const supplier = matchSupplier(header.supplierNif, '', input.suppliers);
  const vehicle = matchVehicle(header.registration, header.chassis, header.vehicleModel, input.vehicles);
  const requisition = matchRequisition(
    supplier?.entity.id || '',
    vehicle?.entity.id || '',
    header.issueDate,
    input.requisitions,
  );
  const costCenter = matchCostCenter(requisition?.entity || null, input.costCenters);

  const warnings: string[] = [];

  if (!header.invoiceNumber) warnings.push('Número da fatura não foi identificado.');
  if (!header.issueDate) warnings.push('Data de emissão não foi identificada.');
  if (!supplier) warnings.push('Fornecedor não foi associado automaticamente.');
  if (!vehicle) warnings.push('Viatura não foi associada automaticamente.');
  if (!requisition) warnings.push('Não foi encontrada uma requisição suficientemente compatível.');
  if (!costCenter) warnings.push('Centro de custo não foi associado automaticamente.');
  if (!lines.length) warnings.push('Nenhuma linha de faturação foi identificada.');
  if (totals.total <= 0) warnings.push('Total da fatura não foi identificado.');

  const qrTotal = Number(qr?.total_com_impostos || 0);
  if (qrTotal > 0 && Math.abs(qrTotal - totals.total) >= 0.02) {
    warnings.push(`Total PDF (${totals.total.toFixed(2)}) difere do QR (${qrTotal.toFixed(2)}).`);
  }

  return {
    invoice_number: {
      value: header.invoiceNumber || null,
      score: header.invoiceNumber ? 100 : 0,
      level: confidenceLevel(header.invoiceNumber ? 100 : 0),
      source: qr?.numero_fatura ? 'qr' : 'pdf',
    },
    issue_date: {
      value: header.issueDate || null,
      score: header.issueDate ? 100 : 0,
      level: confidenceLevel(header.issueDate ? 100 : 0),
      source: qr?.data_fatura ? 'qr' : 'pdf',
    },
    due_date: {
      value: header.dueDate || null,
      score: header.dueDate ? 100 : 0,
      level: confidenceLevel(header.dueDate ? 100 : 0),
      source: 'pdf',
    },
    supplier: supplier ? {
      entity: supplier.entity,
      score: supplier.score,
      reasons: supplier.reasons,
    } : null,
    vehicle: vehicle ? {
      entity: vehicle.entity,
      score: vehicle.score,
      reasons: vehicle.reasons,
    } : null,
    requisition: requisition ? {
      entity: requisition.entity,
      score: requisition.score,
      reasons: requisition.reasons,
    } : null,
    cost_center: costCenter ? {
      entity: costCenter.entity,
      score: costCenter.score,
      reasons: costCenter.reasons,
    } : null,
    lines,
    totals,
    warnings,
    source_text: sourceText,
    parser: 'pdf-text-v2',
  };
}

export function toInvoiceDraft(result: InvoiceEngineResult) {
  return {
    supplier_id: result.supplier?.entity.id || '',
    requisition_id: result.requisition?.entity.id || '',
    vehicle_id: result.vehicle?.entity.id || '',
    cost_center_id: result.cost_center?.entity.id || '',
    invoice_number: String(result.invoice_number.value || ''),
    issue_date: String(result.issue_date.value || ''),
    due_date: String(result.due_date.value || ''),
    lines: result.lines,
    totals: result.totals,
    warnings: result.warnings,
  };
}

export type { InvoiceEngineInput, InvoiceEngineResult, InvoiceEngineLine, InvoiceEngineTotals } from './types';
