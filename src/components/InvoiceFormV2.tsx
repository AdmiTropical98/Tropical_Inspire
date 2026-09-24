import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import type {
  CentroCusto,
  Fornecedor,
  Requisicao,
  SupplierInvoice,
  SupplierInvoiceLine,
  Viatura,
} from '../types';
import { supabase } from '../lib/supabase';
import { createInvoiceImportFromPdf, getInvoiceImport } from '../services/invoiceImportService';
import { matchCostCenter, matchRequisition, matchSupplier, matchVehicle } from '../services/invoiceEngine/entityMatcher';
import { processInvoice, toInvoiceDraft, type InvoiceEngineResult } from '../services/invoiceEngine';
import InvoiceImportReviewV2 from './InvoiceImportReviewV2';

interface Props {
  invoice?: SupplierInvoice | null;
  suppliers: Fornecedor[];
  costCenters: CentroCusto[];
  vehicles: Viatura[];
  requisitions: Requisicao[];
  initialRequisition?: Requisicao | null;
  onSave: (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
  onPersisted?: (payload: {
    savedInvoiceId: string;
    mode: 'create' | 'update';
    hadImport: boolean;
    hadDocument: boolean;
    documentReplaced: boolean;
    invoiceNumber: string;
    issueDate: string;
    totalValue: number;
    destination?: 'Stock' | 'Oficina';
  }) => Promise<void> | void;
  onCancel: () => void;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);

const emptyLine = (): SupplierInvoiceLine => ({
  description: '',
  unidade_medida: 'UN',
  quantity: 1,
  unit_price: 0,
  discount_percentage: 0,
  net_value: 0,
  iva_rate: 23,
  iva_value: 0,
  total_value: 0,
});

const normalizeUnit = (value: string): SupplierInvoiceLine['unidade_medida'] => {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'HOR' || token === 'HRS' || token === 'HR') return 'H';
  if (token === 'UND' || token === 'UNID' || token === 'UNIDADE') return 'UN';
  if (token === 'LT' || token === 'LTS') return 'L';
  if (token === 'CAIXA' || token === 'CAIXAS') return 'CX';
  return (['UN', 'H', 'L', 'CX', 'KG', 'G', 'M', 'M2', 'M3'].includes(token)
    ? token
    : 'UN') as SupplierInvoiceLine['unidade_medida'];
};

export default function InvoiceFormV2({
  invoice,
  suppliers,
  costCenters,
  vehicles,
  requisitions,
  initialRequisition,
  onSave,
  onPersisted,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<InvoiceEngineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existingPdfPreviewUrl, setExistingPdfPreviewUrl] = useState('');
  const [loadingExistingPdf, setLoadingExistingPdf] = useState(false);
  const [form, setForm] = useState(() => ({
    supplier_id: invoice?.supplier_id || initialRequisition?.fornecedorId || '',
    requisition_id: invoice?.requisition_id || initialRequisition?.id || '',
    vehicle_id: invoice?.vehicle_id || initialRequisition?.viaturaId || '',
    cost_center_id: invoice?.cost_center_id || initialRequisition?.centroCustoId || '',
    invoice_number: invoice?.invoice_number || '',
    issue_date: invoice?.issue_date || new Date().toISOString().slice(0, 10),
    due_date: invoice?.due_date || '',
    payment_status: invoice?.payment_status || 'pending',
    payment_method: invoice?.payment_method || '',
    notes: invoice?.notes || '',
    pdf_url: invoice?.pdf_url || '',
    destination: ((initialRequisition?.tipo === 'Stock' || initialRequisition?.tipo === 'Oficina') ? initialRequisition.tipo : '') as '' | 'Stock' | 'Oficina',
    lines: invoice?.lines?.length ? invoice.lines.map(line => ({ ...line })) : [emptyLine()],
  }));

  // Ao editar uma fatura já guardada, o PDF é preservado.
  // pdf_url pode ser uma URL completa ou apenas o caminho no Storage.
  useEffect(() => {
    let cancelled = false;

    const loadExistingPdf = async () => {
      const source = String(invoice?.pdf_url || '').trim();
      if (!source) {
        setExistingPdfPreviewUrl('');
        return;
      }

      if (/^https?:\/\//i.test(source)) {
        setExistingPdfPreviewUrl(source);
        return;
      }

      setLoadingExistingPdf(true);
      try {
        const candidates = [
          { bucket: 'invoices', path: source },
          { bucket: 'documents', path: source },
          ...(source.startsWith('invoices/') ? [{ bucket: 'invoices', path: source.slice('invoices/'.length) }] : []),
          ...(source.startsWith('documents/') ? [{ bucket: 'documents', path: source.slice('documents/'.length) }] : []),
        ];

        for (const candidate of candidates) {
          const { data, error: urlError } = await supabase.storage
            .from(candidate.bucket)
            .createSignedUrl(candidate.path, 60 * 30);

          if (!urlError && data?.signedUrl) {
            if (!cancelled) setExistingPdfPreviewUrl(data.signedUrl);
            return;
          }
        }

        if (!cancelled) setExistingPdfPreviewUrl('');
      } finally {
        if (!cancelled) setLoadingExistingPdf(false);
      }
    };

    void loadExistingPdf();
    return () => { cancelled = true; };
  }, [invoice?.pdf_url]);

  const totals = useMemo(() => {
    const gross = round2(form.lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0));
    const discount = round2(form.lines.reduce((s, l) => {
      const subtotal = Number(l.quantity || 0) * Number(l.unit_price || 0);
      return s + subtotal * Number(l.discount_percentage || 0) / 100;
    }, 0));
    const taxable = round2(form.lines.reduce((s, l) => s + Number(l.net_value || 0), 0));
    const vat = round2(form.lines.reduce((s, l) => s + Number(l.iva_value || 0), 0));
    return { gross, discount, taxable, vat, total: round2(taxable + vat) };
  }, [form.lines]);

  const applyResult = (next: InvoiceEngineResult) => {
    const draft = toInvoiceDraft(next);
    setForm(prev => ({
      ...prev,
      supplier_id: draft.supplier_id || prev.supplier_id,
      requisition_id: draft.requisition_id || prev.requisition_id,
      vehicle_id: draft.vehicle_id || prev.vehicle_id,
      cost_center_id: draft.cost_center_id || prev.cost_center_id,
      invoice_number: draft.invoice_number || prev.invoice_number,
      issue_date: draft.issue_date || prev.issue_date,
      due_date: draft.due_date || prev.due_date,
      lines: draft.lines.length ? draft.lines.map(line => ({
        ...line,
        unidade_medida: normalizeUnit(line.unidade_medida),
        quantity: Number(line.quantity || 0),
        unit_price: Number(line.unit_price || 0),
        discount_percentage: Number(line.discount_percentage || 0),
        net_value: Number(line.net_value || 0),
        iva_rate: Number(line.iva_rate || 23) as 0 | 6 | 13 | 23,
        iva_value: Number(line.iva_value || 0),
        total_value: Number(line.total_value || 0),
      })) : prev.lines,
    }));
    setResult(next);
  };

  const handleFile = async (selected: File) => {
    setFile(selected);
    setError('');
    setLoading(true);
    try {
      if (!selected.type.includes('pdf') && !selected.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('A versão V2 começa por PDFs. Para imagens/scans, o fallback OCR existente continuará disponível.');
      }

      const next = await processInvoice({
        file: selected,
        suppliers,
        vehicles,
        costCenters,
        requisitions,
      });

      // Faturas digitalizadas/scanned PDFs podem não ter qualquer camada de texto.
      // Nesses casos o PDF.js devolve texto vazio; usamos o OCR já existente no projeto.
      const usableLocalRead = Boolean(next.source_text.trim()) && (next.lines.length > 0 || next.totals.total > 0 || Boolean(next.invoice_number.value));
      if (!usableLocalRead) {
        const ocrResult = await readWithExistingOcr(selected);
        applyResult(ocrResult);
      } else {
        applyResult(next);
      }
    } catch (e: any) {
      setError(e?.message || 'Não foi possível ler a fatura.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const buildResultFromOcr = (payload: any): InvoiceEngineResult => {
    const linesRaw = Array.isArray(payload?.lines) && payload.lines.length
      ? payload.lines
      : (Array.isArray(payload?.products) ? payload.products : []);

    const lines = linesRaw.map((line: any, index: number) => {
      const quantity = Number(line.qty ?? line.quantity ?? 0);
      const unitPrice = Number(line.unit_price ?? line.unitPrice ?? 0);
      const discount = Number(line.discount_percentage ?? line.discount ?? 0);
      const gross = round2(quantity * unitPrice);
      const net = Number(line.net_value ?? line.netValue ?? (gross * (1 - discount / 100)));
      const vatRate = Number(line.vat_percent ?? line.iva_rate ?? 23);
      const vatValue = Number(line.vat_value ?? line.iva_value ?? (net * vatRate / 100));
      return {
        description: String(line.description || '').trim(),
        unidade_medida: normalizeUnit(String(line.unidade_medida || line.unit || 'UN')),
        quantity,
        unit_price: unitPrice,
        discount_percentage: discount,
        net_value: round2(net),
        iva_rate: (vatRate === 6 || vatRate === 13 || vatRate === 23 ? vatRate : 0) as 0 | 6 | 13 | 23,
        iva_value: round2(vatValue),
        total_value: round2(net + vatValue),
        source_row: index + 1,
      };
    }).filter((line: any) => line.description && line.quantity > 0 && line.unit_price >= 0);

    const supplierName = String(payload?.supplier || payload?.supplier_name || '').trim();
    const supplierNif = String(payload?.supplier_vat || payload?.supplier_nif || '').replace(/\D/g, '');
    const supplier = matchSupplier(supplierNif, supplierName, suppliers);

    const issueDate = String(payload?.invoice_date || payload?.date || '').trim();
    const dueDate = String(payload?.due_date || payload?.dueDate || '').trim();

    const requisition = initialRequisition
      ? { entity: initialRequisition, score: 100, reasons: ['requisição já selecionada no contexto'] }
      : (() => {
          const reqNumber = String(payload?.requisition_number || payload?.requisition || '').replace(/\s+/g, '').toUpperCase();
          if (reqNumber) {
            const exact = requisitions.find((r: any) =>
              [r.numero, r.number, r.codigo, r.referencia]
                .filter(Boolean)
                .some((v: any) => String(v).replace(/\s+/g, '').toUpperCase() === reqNumber)
            );
            if (exact) return { entity: exact, score: 100, reasons: ['número de requisição exato no OCR'] };
          }
          return matchRequisition(supplier?.entity.id || '', '', issueDate, requisitions);
        })();

    const vehicleRegistration = Array.isArray(payload?.vehicle_registrations)
      ? String(payload.vehicle_registrations[0] || '')
      : String(payload?.vehicle_registration || payload?.registration || '');
    const vehicle = matchVehicle(vehicleRegistration, String(payload?.chassis || ''), String(payload?.vehicle_model || ''), vehicles);
    const finalVehicle = vehicle || (requisition?.entity?.viaturaId
      ? (() => {
          const entity = vehicles.find(v => v.id === requisition.entity.viaturaId);
          return entity ? { entity, score: 100, reasons: ['viatura herdada da requisição'] } : null;
        })()
      : null);

    const costCenter = matchCostCenter(requisition?.entity || null, costCenters);
    const taxable = round2(Number(payload?.net_amount ?? payload?.net_total ?? lines.reduce((sum: number, l: any) => sum + l.net_value, 0)));
    const vat = round2(Number(payload?.vat_amount ?? payload?.vat_total ?? lines.reduce((sum: number, l: any) => sum + l.iva_value, 0)));
    const total = round2(Number(payload?.total_amount ?? payload?.total ?? taxable + vat));
    const gross = round2(lines.reduce((sum: number, l: any) => sum + l.quantity * l.unit_price, 0));
    const discounts = round2(Math.max(0, gross - taxable));

    const warnings: string[] = [];
    if (!payload?.invoice_number) warnings.push('Número da fatura não foi identificado.');
    if (!issueDate) warnings.push('Data de emissão não foi identificada.');
    if (!dueDate) warnings.push('Data de vencimento não foi identificada.');
    if (!supplier) warnings.push('Fornecedor não foi associado automaticamente.');
    if (!finalVehicle) warnings.push('Viatura não foi associada automaticamente.');
    if (!requisition) warnings.push('Não foi encontrada uma requisição suficientemente compatível.');
    if (!costCenter) warnings.push('Centro de custo não foi associado automaticamente.');
    if (!lines.length) warnings.push('Nenhuma linha de faturação foi identificada.');
    if (total <= 0) warnings.push('Total da fatura não foi identificado.');

    return {
      invoice_number: { value: String(payload?.invoice_number || ''), score: payload?.invoice_number ? 100 : 0, level: payload?.invoice_number ? 'high' : 'low', source: 'ocr' },
      issue_date: { value: issueDate, score: issueDate ? 100 : 0, level: issueDate ? 'high' : 'low', source: 'ocr' },
      due_date: { value: dueDate, score: dueDate ? 100 : 0, level: dueDate ? 'high' : 'low', source: 'ocr' },
      supplier,
      vehicle: finalVehicle,
      requisition,
      cost_center: costCenter,
      lines,
      totals: { gross, discounts, taxable, vat, total },
      warnings,
      source_text: JSON.stringify(payload),
      requisition_number: String(payload?.requisition_number || payload?.requisition || ''),
      parser: 'pdf-text-v3',
    };
  };

  const readWithExistingOcr = async (selected: File): Promise<InvoiceEngineResult> => {
    const created = await createInvoiceImportFromPdf(selected, undefined, 'full');

    let current = created;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (current.status === 'ready' || current.status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 1500));
      current = await getInvoiceImport(created.id);
    }

    if (current.status === 'failed') {
      throw new Error(current.error || 'O OCR da fatura falhou.');
    }
    if (!current.extracted_json) {
      throw new Error('O OCR terminou sem dados extraídos.');
    }

    return buildResultFromOcr(current.extracted_json);
  };

  const uploadDocument = async (selected: File) => {
    const path = `invoices/${Date.now()}-${selected.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    for (const bucket of ['invoices', 'documents']) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, selected, { upsert: false, contentType: selected.type || 'application/pdf' });
      if (!uploadError) return path;
    }
    return form.pdf_url || '';
  };

  const updateLine = (index: number, patch: Partial<SupplierInvoiceLine>) => {
    setForm(prev => {
      const lines = prev.lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        const quantity = Number(next.quantity || 0);
        const unitPrice = Number(next.unit_price || 0);
        const discount = Number(next.discount_percentage || 0);
        const net = round2(quantity * unitPrice * (1 - discount / 100));
        const iva = round2(net * Number(next.iva_rate || 0) / 100);
        return {
          ...next,
          net_value: net,
          iva_value: iva,
          total_value: round2(net + iva),
        };
      });
      return { ...prev, lines };
    });
  };

  const handleSave = async () => {
    const validLines = form.lines.filter(line => line.description.trim() || Number(line.net_value) > 0);
    if (!form.supplier_id) return setError('Selecione o fornecedor.');
    if (!form.invoice_number.trim()) return setError('Indique o número da fatura.');
    if (!form.issue_date) return setError('Indique a data de emissão.');
    if (!validLines.length) return setError('A fatura tem de ter pelo menos uma linha.');
    if (totals.total <= 0) return setError('O total da fatura tem de ser superior a 0 €.');
    if (!form.vehicle_id && !form.destination) return setError('Sem matrícula: indique se a fatura foi para Stock ou Oficina.');

    setSaving(true);
    setError('');

    try {
      /*
       * CORREÇÃO CRÍTICA:
       * Não fazer upload do PDF ANTES de gravar a fatura.
       * Se o Storage ficar pendurado, o botão ficava eternamente em
       * "A guardar..." e a gravação nunca chegava ao Supabase.
       *
       * A fatura é agora gravada primeiro. O PDF é tratado depois.
       */
      const savedInvoiceId = await onSave({
        supplier_id: form.supplier_id,
        requisition_id: form.requisition_id || undefined,
        invoice_number: form.invoice_number.trim(),
        issue_date: form.issue_date,
        due_date: form.due_date || undefined,
        base_amount: totals.gross,
        iva_rate: 23,
        iva_value: totals.vat,
        discount: { type: 'amount', value: totals.discount, applied_value: totals.discount },
        extra_expenses: [],
        total: totals.total,
        total_liquido: totals.taxable,
        total_iva: totals.vat,
        total_final: totals.total,
        net_value: totals.taxable,
        vat_value: totals.vat,
        total_value: totals.total,
        lines: validLines,
        expense_type: 'supplier_invoice',
        cost_center_id: form.cost_center_id || undefined,
        vehicle_id: form.vehicle_id || undefined,
        payment_status: form.payment_status as SupplierInvoice['payment_status'],
        payment_method: form.payment_method || undefined,
        notes: form.notes || undefined,
        pdf_url: form.pdf_url || undefined,
      });

      /*
       * Não bloquear o fecho da janela por causa do histórico da requisição.
       * O modal trata isto em background.
       */
      void Promise.resolve(onPersisted?.({
        savedInvoiceId,
        mode: invoice ? 'update' : 'create',
        hadImport: Boolean(result),
        hadDocument: Boolean(form.pdf_url),
        documentReplaced: Boolean(invoice?.pdf_url && form.pdf_url && invoice.pdf_url !== form.pdf_url),
        invoiceNumber: form.invoice_number,
        issueDate: form.issue_date,
        totalValue: totals.total,
        destination: !form.vehicle_id && form.destination ? form.destination : undefined,
      })).catch((persistError) => {
        console.warn('Atualização pós-gravação da requisição falhou:', persistError);
      });

      /*
       * Fecha imediatamente depois da gravação da BD.
       * O upload do PDF não pode impedir a fatura de ser criada.
       */
      onCancel();

      if (file) {
        void (async () => {
          try {
            const pdfUrl = await uploadDocument(file);

            if (pdfUrl && savedInvoiceId) {
              const { error: pdfUpdateError } = await supabase
                .from('supplier_invoices')
                .update({ pdf_url: pdfUrl })
                .eq('id', savedInvoiceId);

              if (pdfUpdateError) {
                console.warn('Fatura guardada, mas não foi possível associar o PDF:', pdfUpdateError);
              }
            }
          } catch (pdfError) {
            console.warn('Fatura guardada, mas o upload do PDF falhou:', pdfError);
          }
        })();
      }
    } catch (e: any) {
      console.error('InvoiceFormV2 save failed:', e);
      setError(e?.message || 'Erro ao guardar a fatura.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{invoice ? 'Editar Fatura' : 'Nova Fatura — Engine V2'}</h2>
          <p className="mt-1 text-sm text-slate-500">Importação separada da gravação. Os dados antigos não são alterados.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      {!result && !invoice && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 font-bold text-slate-900">Ler nova fatura</h3>
          <p className="mt-1 text-sm text-slate-500">PDF digital. O motor extrai cabeçalho, linhas, descontos, IVA e relações.</p>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            {loading ? 'A ler fatura...' : 'Escolher PDF'}
          </button>
        </div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      {result && !saving && (
        <InvoiceImportReviewV2
          result={result}
          onCancel={() => { setResult(null); setFile(null); }}
          onConfirm={() => applyResult(result)}
        />
      )}

      {(result || invoice) && (
        <div className="space-y-5">
          {invoice && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900">Fatura anexada</div>
                  <div className="text-sm text-slate-500">O PDF guardado nesta fatura é mantido ao editar.</div>
                </div>
                {existingPdfPreviewUrl && (
                  <a href={existingPdfPreviewUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Abrir PDF</a>
                )}
              </div>
              {loadingExistingPdf && <div className="mt-3 text-sm text-slate-500">A carregar PDF...</div>}
              {!loadingExistingPdf && existingPdfPreviewUrl && (
                <iframe title="Pré-visualização da fatura" src={existingPdfPreviewUrl} className="mt-4 h-[520px] w-full rounded-xl border bg-white" />
              )}
              {!loadingExistingPdf && !existingPdfPreviewUrl && (
                <div className="mt-3 text-sm text-amber-700">O PDF está associado à fatura, mas não foi possível gerar a pré-visualização neste momento.</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700">Fornecedor
              <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="mt-1 w-full rounded-lg border p-2">
                <option value="">Selecionar</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Nº Fatura
              <input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Emissão
              <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Vencimento
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <EntityField label="Requisição" value={form.requisition_id} options={requisitions.map(r => ({ id: r.id, label: String(r.numero || r.id) }))} onChange={v => {
              const req = requisitions.find(r => r.id === v);
              setForm(prev => ({ ...prev, requisition_id: v, vehicle_id: req?.viaturaId || prev.vehicle_id, cost_center_id: req?.centroCustoId || prev.cost_center_id }));
            }} />
            <EntityField label="Viatura" value={form.vehicle_id} options={vehicles.map(v => ({ id: v.id, label: String(v.matricula || v.id) }))} onChange={v => setForm({ ...form, vehicle_id: v })} />
            <EntityField label="Centro de custo" value={form.cost_center_id} options={costCenters.map(c => ({ id: c.id, label: String(c.nome || c.id) }))} onChange={v => setForm({ ...form, cost_center_id: v })} />
          </div>

          {!form.vehicle_id && (
            <label className="text-sm font-semibold text-slate-700">
              Destino sem matrícula
              <select
                value={form.destination}
                onChange={e => setForm(prev => ({ ...prev, destination: e.target.value as '' | 'Stock' | 'Oficina' }))}
                className="mt-1 w-full rounded-lg border p-2"
              >
                <option value="">Selecionar destino</option>
                <option value="Stock">Stock</option>
                <option value="Oficina">Oficina</option>
              </select>
            </label>
          )}

          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="p-2 text-left">Descrição</th><th className="p-2">Qtd</th><th className="p-2">Unid.</th><th className="p-2">Preço</th><th className="p-2">Desc.</th><th className="p-2">IVA</th><th className="p-2">Total</th>
              </tr></thead>
              <tbody>
                {form.lines.map((line, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2"><input value={line.description} onChange={e => updateLine(i, { description: e.target.value })} className="w-full rounded border p-2" /></td>
                    <td className="p-2"><input type="number" value={line.quantity} onChange={e => updateLine(i, { quantity: Number(e.target.value) })} className="w-20 rounded border p-2" /></td>
                    <td className="p-2"><select value={line.unidade_medida} onChange={e => updateLine(i, { unidade_medida: normalizeUnit(e.target.value) })} className="rounded border p-2">
                      {['UN','H','L','CX','KG','G','M','M2','M3'].map(u => <option key={u}>{u}</option>)}
                    </select></td>
                    <td className="p-2"><input type="number" step="0.01" value={line.unit_price} onChange={e => updateLine(i, { unit_price: Number(e.target.value) })} className="w-24 rounded border p-2" /></td>
                    <td className="p-2"><input type="number" step="0.01" value={line.discount_percentage || 0} onChange={e => updateLine(i, { discount_percentage: Number(e.target.value) })} className="w-20 rounded border p-2" /></td>
                    <td className="p-2"><select value={line.iva_rate} onChange={e => updateLine(i, { iva_rate: Number(e.target.value) as 0 | 6 | 13 | 23 })} className="rounded border p-2"><option value={0}>0%</option><option value={6}>6%</option><option value={13}>13%</option><option value={23}>23%</option></select></td>
                    <td className="p-2 text-right font-semibold">{money(line.total_value || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Estado do pagamento
              <select
                value={form.payment_status}
                onChange={e => setForm(prev => ({ ...prev, payment_status: e.target.value as SupplierInvoice['payment_status'] }))}
                className="mt-1 w-full rounded-lg border p-2"
              >
                <option value="pending">Pendente</option>
                <option value="scheduled">Agendado</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Método de pagamento
              <select
                value={form.payment_method}
                onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                className="mt-1 w-full rounded-lg border p-2"
              >
                <option value="">Selecionar</option>
                <option value="transfer">Transferência</option>
                <option value="check">Cheque</option>
                <option value="card">Cartão</option>
                <option value="cash">Dinheiro</option>
                <option value="direct_debit">Débito Direto</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Summary label="Bruto" value={totals.gross} />
            <Summary label="Descontos" value={totals.discount} />
            <Summary label="Base" value={totals.taxable} />
            <Summary label="IVA" value={totals.vat} />
            <Summary label="Total" value={totals.total} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-xl border px-5 py-3 font-semibold">Cancelar</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {saving ? 'A guardar...' : 'Guardar fatura'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntityField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">{label}
      <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border p-2">
        <option value="">Selecionar</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-bold">{money(value)}</div></div>;
}
