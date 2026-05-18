import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Filter, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatCurrency } from '../../utils/format';
import { getMonthlyReportData, type MonthlyReportData } from '../../services/monthlyReportsService';

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

const exportReportToPdf = (report: MonthlyReportData) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Relatório Mensal - ${report.periodLabel}`, 14, 18);

  autoTable(doc, {
    startY: 26,
    head: [['Métrica', 'Valor']],
    body: [
      ['Custo total de combustível', formatCurrency(report.totalFuelCost)],
      ['Custo de manutenção', formatCurrency(report.totalMaintenanceCost)],
      ['Custo de requisições de oficina', formatCurrency(report.totalWorkshopRequisitionCost)],
      ['Custo total operacional', formatCurrency(report.totalOperationalCost)],
      ['Número de serviços realizados', String(report.servicesCount)],
    ],
  });

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8) : 90,
    head: [['Cliente', 'Custo']],
    body: report.costsByClient.map((item) => [item.clientName, formatCurrency(item.totalCost)]),
  });

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8) : 140,
    head: [['Viatura', 'Custo']],
    body: report.costsByVehicle.map((item) => [item.vehicleName, formatCurrency(item.totalCost)]),
  });

  doc.addPage();
  doc.setFontSize(14);
  doc.text('Atividade de Motoristas', 14, 18);
  autoTable(doc, {
    startY: 24,
    head: [['Motorista', 'Horas trabalhadas', 'Serviços']],
    body: report.driverActivity.map((item) => [item.driverName, String(item.workedHours), String(item.servicesCount)]),
  });

  doc.save(`relatorio_mensal_${report.periodLabel.replace('/', '_')}.pdf`);
};

const exportReportToExcel = (report: MonthlyReportData) => {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    { metrica: 'Custo total de combustível', valor: report.totalFuelCost },
    { metrica: 'Custo de manutenção', valor: report.totalMaintenanceCost },
    { metrica: 'Custo de requisições de oficina', valor: report.totalWorkshopRequisitionCost },
    { metrica: 'Custo total operacional', valor: report.totalOperationalCost },
    { metrica: 'Número de serviços realizados', valor: report.servicesCount },
  ]);

  const byClientSheet = XLSX.utils.json_to_sheet(
    report.costsByClient.map((item) => ({ cliente: item.clientName, custo: item.totalCost })),
  );

  const byVehicleSheet = XLSX.utils.json_to_sheet(
    report.costsByVehicle.map((item) => ({ viatura: item.vehicleName, custo: item.totalCost })),
  );

  const activitySheet = XLSX.utils.json_to_sheet(
    report.driverActivity.map((item) => ({
      motorista: item.driverName,
      horas_trabalhadas: item.workedHours,
      servicos: item.servicesCount,
    })),
  );

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
  XLSX.utils.book_append_sheet(workbook, byClientSheet, 'Custos por Cliente');
  XLSX.utils.book_append_sheet(workbook, byVehicleSheet, 'Custos por Viatura');
  XLSX.utils.book_append_sheet(workbook, activitySheet, 'Atividade Motoristas');

  XLSX.writeFile(workbook, `relatorio_mensal_${report.periodLabel.replace('/', '_')}.xlsx`);
};

export default function MonthlyReportsView() {
  const currentDate = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<number>(currentDate.getMonth() + 1);
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MonthlyReportData | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getMonthlyReportData({ month, year });
      setReport(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao gerar relatório mensal.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/50 bg-white/90 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Mês</span>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-900"
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
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-900"
            />
          </label>

          <button
            type="button"
            onClick={loadReport}
            className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-600/30 md:col-span-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            Gerar relatório
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </section>

      {report && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Combustível" value={formatCurrency(report.totalFuelCost)} />
            <MetricCard title="Manutenção" value={formatCurrency(report.totalMaintenanceCost)} />
            <MetricCard title="Requisições" value={formatCurrency(report.totalWorkshopRequisitionCost)} />
            <MetricCard title="Custo operacional" value={formatCurrency(report.totalOperationalCost)} />
            <MetricCard title="Serviços" value={String(report.servicesCount)} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DataTable
              title="Custos por Cliente"
              headers={['Cliente', 'Custo']}
              rows={report.costsByClient.map((item) => [item.clientName, formatCurrency(item.totalCost)])}
            />
            <DataTable
              title="Custos por Viatura"
              headers={['Viatura', 'Custo']}
              rows={report.costsByVehicle.map((item) => [item.vehicleName, formatCurrency(item.totalCost)])}
            />
          </section>

          <DataTable
            title="Atividade dos Motoristas"
            headers={['Motorista', 'Horas trabalhadas', 'Serviços']}
            rows={report.driverActivity.map((item) => [item.driverName, String(item.workedHours), String(item.servicesCount)])}
          />

          <section className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportReportToPdf(report)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-700"
            >
              <FileDown className="h-4 w-4" /> Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => exportReportToExcel(report)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 hover:bg-slate-700"
            >
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
      <p className="text-xs uppercase text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4">
      <h3 className="mb-3 text-sm font-bold uppercase text-slate-300">{title}</h3>
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white/90 text-xs uppercase text-slate-400">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell, index) => (
                  <td key={`${cell}-${index}`} className="px-3 py-2 text-slate-200">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
