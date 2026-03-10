import { useMemo, useState } from 'react';
import { Calculator, FileDown, FileSpreadsheet, Loader2, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  processSalaries,
  saveSalaryRun,
  type SalaryLineResult,
} from '../../services/salaryService';
import { formatCurrency } from '../../utils/format';

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const exportPayslipPdf = (line: SalaryLineResult, month: number, year: number) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Recibo de Vencimento - ${line.driverName}`, 14, 18);
  doc.setFontSize(11);
  doc.text(`Período: ${String(month).padStart(2, '0')}/${year}`, 14, 26);

  autoTable(doc, {
    startY: 34,
    head: [['Descrição', 'Valor']],
    body: [
      ['Salário base', formatCurrency(line.baseSalary)],
      ['Horas extra', `${line.extraHours} h`],
      ['Pagamento horas extra', formatCurrency(line.extraPay)],
      ['Horas noturnas', `${line.nightHours} h`],
      ['Pagamento noturno', formatCurrency(line.nightPay)],
      ['Prémios', formatCurrency(line.bonuses)],
      ['Descontos adicionais', formatCurrency(line.deductions)],
      ['Salário bruto', formatCurrency(line.grossSalary)],
      ['Desconto Segurança Social (11%)', formatCurrency(line.ssDiscount)],
      ['Desconto IRS (12%)', formatCurrency(line.irsDiscount)],
      ['Salário líquido', formatCurrency(line.netSalary)],
    ],
  });

  doc.save(`recibo_${line.driverName.replace(/\s+/g, '_').toLowerCase()}_${year}_${String(month).padStart(2, '0')}.pdf`);
};

const exportSummaryExcel = (lines: SalaryLineResult[], month: number, year: number) => {
  const rows = lines.map((line) => ({
    motorista: line.driverName,
    salario_base: line.baseSalary,
    horas_extra: line.extraHours,
    pagamento_horas_extra: line.extraPay,
    horas_noturnas: line.nightHours,
    pagamento_noturno: line.nightPay,
    premios: line.bonuses,
    descontos_adicionais: line.deductions,
    salario_bruto: line.grossSalary,
    desconto_ss: line.ssDiscount,
    desconto_irs: line.irsDiscount,
    salario_liquido: line.netSalary,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Resumo Salarial');
  XLSX.writeFile(workbook, `salarios_${year}_${String(month).padStart(2, '0')}.xlsx`);
};

export default function SalariosPage() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [lines, setLines] = useState<SalaryLineResult[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLine = lines.find((line) => line.driverId === selectedDriverId) ?? null;

  const totals = useMemo(() => lines.reduce((acc, line) => {
    acc.gross += line.grossSalary;
    acc.net += line.netSalary;
    acc.ss += line.ssDiscount;
    acc.irs += line.irsDiscount;
    return acc;
  }, { gross: 0, net: 0, ss: 0, irs: 0 }), [lines]);

  const runProcessing = async () => {
    setIsProcessing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const processed = await processSalaries({ month, year });
      setLines(processed);
      setSelectedDriverId(processed[0]?.driverId ?? '');
      setStatusMessage(`Processamento concluído para ${processed.length} motoristas.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar salários.';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const persistProcessing = async () => {
    if (lines.length === 0) {
      setError('Não existem dados processados para guardar.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const salaryRunId = await saveSalaryRun({ month, year }, lines);
      setStatusMessage(`Processamento guardado com sucesso. Execução: ${salaryRunId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao guardar salários.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5">
        <h1 className="text-2xl font-black text-white">Processamento de Salários</h1>
        <p className="mt-1 text-sm text-slate-400">Cálculo automático de bruto, SS, IRS e salário líquido por motorista.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Mês</span>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            >
              {MONTHS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Ano</span>
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            />
          </label>

          <button
            type="button"
            onClick={runProcessing}
            className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-600/30"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Processar mês
          </button>

          <button
            type="button"
            onClick={persistProcessing}
            disabled={isSaving || lines.length === 0}
            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar processamento
          </button>
        </div>

        {statusMessage && <p className="mt-3 text-sm text-emerald-300">{statusMessage}</p>}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Total Bruto" value={formatCurrency(totals.gross)} />
        <SummaryCard title="Total Líquido" value={formatCurrency(totals.net)} />
        <SummaryCard title="Total SS" value={formatCurrency(totals.ss)} />
        <SummaryCard title="Total IRS" value={formatCurrency(totals.irs)} />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Recibo individual</span>
            <select
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="min-w-64 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            >
              {lines.map((line) => (
                <option key={line.driverId} value={line.driverId}>{line.driverName}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!selectedLine}
            onClick={() => {
              if (selectedLine) exportPayslipPdf(selectedLine, month, year);
            }}
            className="mt-5 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" /> Exportar recibo PDF
          </button>

          <button
            type="button"
            disabled={lines.length === 0}
            onClick={() => exportSummaryExcel(lines, month, year)}
            className="mt-5 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar resumo Excel
          </button>
        </div>

        <div className="max-h-[540px] overflow-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Motorista</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-right">Extra</th>
                <th className="px-3 py-2 text-right">Noturno</th>
                <th className="px-3 py-2 text-right">Prémios</th>
                <th className="px-3 py-2 text-right">Descontos</th>
                <th className="px-3 py-2 text-right">Bruto</th>
                <th className="px-3 py-2 text-right">SS</th>
                <th className="px-3 py-2 text-right">IRS</th>
                <th className="px-3 py-2 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lines.map((line) => (
                <tr key={line.driverId} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-200">{line.driverName}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{formatCurrency(line.baseSalary)}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{formatCurrency(line.extraPay)}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{formatCurrency(line.nightPay)}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{formatCurrency(line.bonuses)}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{formatCurrency(line.deductions)}</td>
                  <td className="px-3 py-2 text-right text-amber-300">{formatCurrency(line.grossSalary)}</td>
                  <td className="px-3 py-2 text-right text-red-300">{formatCurrency(line.ssDiscount)}</td>
                  <td className="px-3 py-2 text-right text-red-300">{formatCurrency(line.irsDiscount)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-300">{formatCurrency(line.netSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs uppercase text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}
