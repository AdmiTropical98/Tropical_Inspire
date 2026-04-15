import { useMemo } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { FileDown, FileSpreadsheet, Clock, Euro, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateShift } from './HoursCalculator';

interface HoursMonthlyReportProps {
    selectedMonth: string; // YYYY-MM
}

interface DriverReport {
    driverName: string;
    daysWorked: number;
    totalH: string;
    nightH: string;
    extraH: string;
    rate: number;
    totalPay: number;
}

export default function HoursMonthlyReport({ selectedMonth }: HoursMonthlyReportProps) {
    const { motoristas, manualHours } = useWorkshop();

    // 1. Aggregate Data with Calculator Logic
    const data = useMemo(() => {
        const reportData: DriverReport[] = [];

        motoristas.forEach(driver => {
            const monthRecords = manualHours.filter(h =>
                h.motoristaId === driver.id &&
                h.date.startsWith(selectedMonth)
            );

            if (monthRecords.length === 0) return;

            let totalMinutes = 0;
            // let normalMinutes = 0; // Not directly used in final report or totalValue calculation
            let nightMinutes = 0;
            let extraMinutes = 0;
            let daysWorked = new Set(monthRecords.map(r => r.date)).size;

            monthRecords.forEach(rec => {
                const calc = calculateShift(rec.startTime, rec.endTime, rec.breakDuration);
                totalMinutes += calc.totalMinutes;
                // normalMinutes += calc.normalMinutes; // Not directly used
                nightMinutes += calc.nightMinutes;
                extraMinutes += calc.extraMinutes;
            });

            const rate = driver.valorHora || 0;
            // const nightRate = rate * 1.25; // Example: 25% extra for night - Not used in final totalValue
            // const extraRate = rate * 1.5;  // Example: 50% extra for overtime - Not used in final totalValue

            // Note: This is an example formula. Adjust if specific rules applied.
            // Using standard total * rate for now but providing visibility on extra types.
            // const extraPayValue = (extraMinutes / 60) * extraRate; // Not used in final totalValue
            // const nightPayValue = (nightMinutes / 60) * (nightRate - rate); 
            // Let's simplify: Total Pay = (NormalH * Rate) + (NightH * NightRate) + (ExtraH * ExtraRate)
            // But wait, the user said "Cálculo automático: horas normais | horas noturnas | horas extra".
            // Let's just calculate total value based strictly on hours.
            const totalValue = (totalMinutes / 60) * rate;

            reportData.push({
                driverName: driver.nome,
                daysWorked,
                totalH: (totalMinutes / 60).toFixed(2),
                nightH: (nightMinutes / 60).toFixed(2),
                extraH: (extraMinutes / 60).toFixed(2),
                rate: rate,
                totalPay: totalValue
            });
        });

        return reportData;
    }, [motoristas, manualHours, selectedMonth]);

    const globalStats = useMemo(() => {
        const totalPay = data.reduce((acc, curr) => acc + curr.totalPay, 0);
        const totalHours = data.reduce((acc, curr) => acc + Number(curr.totalH), 0);
        return {
            totalPay: totalPay.toFixed(2) + ' €',
            totalHours: Math.round(totalHours) + 'h',
            driversCount: data.length
        };
    }, [data]);

    const generatePDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
        doc.setFontSize(22);
        doc.text('Folha Salarial - Gestão de Horas', 14, 20);
        doc.setFontSize(10);
        doc.text(`Mês Referência: ${selectedMonth} | Gerado: ${new Date().toLocaleString()}`, 14, 28);

        const tableColumn = ["Motorista", "Dias", "Horas Totais", "H. Noturnas", "H. Extra", "Taxa/Hora", "Valor Total"];
        const tableRows = data.map(row => [
            row.driverName,
            row.daysWorked,
            row.totalH + ' h',
            row.nightH + ' h',
            row.extraH + ' h',
            row.rate.toFixed(2) + ' €/h',
            row.totalPay.toFixed(2) + ' €'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows as (string | number)[][],
            startY: 35,
            styles: { fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        doc.save(`Payroll_${selectedMonth}.pdf`);
    };

    const generateExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(data.map(r => ({
            'Motorista': r.driverName,
            'Dias Trabalhados': r.daysWorked,
            'Horas Totais': r.totalH,
            'Horas Noturnas': r.nightH,
            'Horas Extra': r.extraH,
            'Valor Hora (€)': r.rate,
            'Valor Total (€)': r.totalPay.toFixed(2)
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");
        XLSX.writeFile(workbook, `Payroll_GestaoHoras_${selectedMonth}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Summary Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/90 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Massa Salarial</p>
                        <h3 className="text-2xl font-black text-emerald-400">{globalStats.totalPay}</h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                        <Euro className="w-6 h-6 text-emerald-500" />
                    </div>
                </div>
                <div className="bg-white/90 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Total Esforço</p>
                        <h3 className="text-2xl font-black text-slate-900">{globalStats.totalHours}</h3>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-2xl">
                        <Clock className="w-6 h-6 text-blue-500" />
                    </div>
                </div>
                <div className="bg-white/90 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Ativos no Mês</p>
                        <h3 className="text-2xl font-black text-blue-400">{globalStats.driversCount} Motoristas</h3>
                    </div>
                    <div className="p-3 bg-blue-400/10 rounded-2xl">
                        <Users className="w-6 h-6 text-blue-400" />
                    </div>
                </div>
            </div>

            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90/80 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-600/10 rounded-xl">
                        <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-slate-900 font-black uppercase tracking-tighter text-lg">Relatório Payroll</h2>
                        <span className="text-slate-500 text-xs font-mono">{selectedMonth}</span>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={generateExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-700 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-white/5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        Exportar Excel
                    </button>
                    <button onClick={generatePDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-900/20">
                        <FileDown className="w-4 h-4" />
                        PDF Payroll
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white/90 border border-white/5 rounded-3xl overflow-hidden shadow-2xl overflow-x-auto table-scroll">
                <table className="w-full text-left text-sm" style={{ minWidth: '800px' }}>
                    <thead>
                        <tr className="bg-white/90 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-white/5">
                            <th className="p-5">Motorista</th>
                            <th className="p-5 text-center">Dias</th>
                            <th className="p-5 text-center">Horas Totais</th>
                            <th className="p-5 text-center text-purple-400">Noturnas</th>
                            <th className="p-5 text-center text-amber-400">Extra</th>
                            <th className="p-5 text-right">Taxa/H</th>
                            <th className="p-5 text-right text-emerald-400">Total Mensal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.length === 0 ? (
                            <tr><td colSpan={7} className="p-20 text-center text-slate-600 font-medium italic">Nenhum registo encontrado para o período selecionado.</td></tr>
                        ) : (
                            data.map((row, i) => (
                                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-5 font-black text-slate-900 uppercase tracking-tighter">{row.driverName}</td>
                                    <td className="p-5 text-center">
                                        <span className="bg-slate-100 px-2 py-1 rounded-lg text-slate-400 font-mono">{row.daysWorked}</span>
                                    </td>
                                    <td className="p-5 text-center font-mono font-bold text-slate-300">{row.totalH} h</td>
                                    <td className="p-5 text-center font-mono text-purple-400/80">{row.nightH} h</td>
                                    <td className="p-5 text-center font-mono text-amber-400/80">{row.extraH} h</td>
                                    <td className="p-5 text-right font-mono text-slate-500">{row.rate.toFixed(2)} €/h</td>
                                    <td className="p-5 text-right font-black text-emerald-400 text-lg">
                                        <span className="opacity-50 text-xs font-normal mr-1">€</span>
                                        {row.totalPay.toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
