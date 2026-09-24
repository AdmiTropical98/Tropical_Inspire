import React from 'react';
import type { InvoiceEngineResult } from '../services/invoiceEngine';

interface Props {
  result: InvoiceEngineResult;
  onConfirm: () => void;
  onCancel: () => void;
}

const money = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);

const confidenceClass = (score: number) =>
  score >= 90 ? 'bg-emerald-100 text-emerald-800' :
  score >= 70 ? 'bg-amber-100 text-amber-800' :
  'bg-red-100 text-red-800';

export default function InvoiceImportReviewV2({ result, onConfirm, onCancel }: Props) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Revisão da fatura importada</h3>
        <p className="mt-1 text-sm text-slate-500">
          O sistema separou a leitura da fatura da gravação. Nada é alterado até confirmares.
        </p>
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-semibold text-amber-900">Atenção</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
            {result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Nº Fatura" value={String(result.invoice_number.value || '')} score={result.invoice_number.score} />
        <Field label="Emissão" value={String(result.issue_date.value || '')} score={result.issue_date.score} />
        <Field label="Vencimento" value={String(result.due_date.value || '')} score={result.due_date.score} />
        <Field label="Fornecedor" value={result.supplier?.entity.nome || 'Não associado'} score={result.supplier?.score || 0} />
        <Field label="Viatura" value={result.vehicle?.entity.matricula || 'Não associada'} score={result.vehicle?.score || 0} />
        <Field label="Requisição" value={result.requisition?.entity.numero || 'Não associada'} score={result.requisition?.score || 0} />
        <Field label="Centro de custo" value={result.cost_center?.entity.nome || 'Não associado'} score={result.cost_center?.score || 0} />
        <Field label="Total" value={money(result.totals.total)} score={result.totals.total > 0 ? 100 : 0} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Desc.</th>
              <th className="px-3 py-2 text-right">Base</th>
              <th className="px-3 py-2 text-right">IVA</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line, i) => (
              <tr key={`${line.description}-${i}`} className="border-t border-slate-100">
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right">{line.quantity}</td>
                <td className="px-3 py-2 text-right">{money(line.unit_price)}</td>
                <td className="px-3 py-2 text-right">{line.discount_percentage || 0}%</td>
                <td className="px-3 py-2 text-right">{money(line.net_value)}</td>
                <td className="px-3 py-2 text-right">{money(line.iva_value)}</td>
                <td className="px-3 py-2 text-right">{money(line.total_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Summary label="Bruto" value={result.totals.gross} />
        <Summary label="Descontos" value={result.totals.discounts} />
        <Summary label="Base" value={result.totals.taxable} />
        <Summary label="IVA" value={result.totals.vat} />
        <Summary label="Total" value={result.totals.total} />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">
          Confirmar importação
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-slate-900">{value || '—'}</div>
      <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${confidenceClass(score)}`}>
        {score}%
      </span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-900">{money(value)}</div>
    </div>
  );
}
