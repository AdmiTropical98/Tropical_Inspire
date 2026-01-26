import { useWorkshop } from '../../contexts/WorkshopContext';
import { Download, Calculator } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface HoursMonthlyReportProps {
    selectedMonth: string; // YYYY-MM
}

export default function HoursMonthlyReport({ selectedMonth }: HoursMonthlyReportProps) {
    const { motoristas, manualHours } = useWorkshop();

    // 1. Aggregate Data
    const processData = () => {
        const reportData: any[] = [];

        motoristas.forEach(driver => {
            // Find all records for this month
            const monthRecords = manualHours.filter(h =>
                h.motoristaId === driver.id &&
                h.date.startsWith(selectedMonth)
            );

            if (monthRecords.length === 0) return;

            let totalMinutes = 0;
            let totalOvertimeMinutes = 0;
            let daysWorked = 0;

            monthRecords.forEach(rec => {
                const [h1, m1] = rec.startTime.split(':').map(Number);
                const [h2, m2] = rec.endTime.split(':').map(Number);

                const startMin = h1 * 60 + m1;
                const endMin = h2 * 60 + m2;
                const workMin = Math.max(0, (endMin - startMin) - rec.breakDuration);

                totalMinutes += workMin;
                daysWorked++;

                // Overtime Calculation (Standard 9h = 540m)
                // Note: User can configure standard day later. Hardcoded 9h for now as per prev context.
                const standardDay = 9 * 60;
                if (workMin > standardDay) {
                    totalOvertimeMinutes += (workMin - standardDay);
                }
            });

            // Costs
            const overtimeHours = totalOvertimeMinutes / 60;
            const rate = driver.valorHora || 0;
            const extraPay = overtimeHours * rate;
            const baseSalary = driver.vencimentoBase || 0;

            // Should we prorate base salary? Usually fixed.
            // Let's assume fixed Base + Extras. 
            // Total = Base + Extras.

            reportData.push({
                driverName: driver.nome,
                daysWorked,
                totalHours: (totalMinutes / 60).toFixed(2),
                overtimeHours: overtimeHours.toFixed(2),
                baseSalary: baseSalary,
                extraPay: extraPay,
                totalPay: baseSalary + extraPay
            });
        });

        return reportData;
    };

    const data = processData();

    const generatePDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Relatório Mensal de Horas', 14, 22);

        doc.setFontSize(10);
        doc.text(`Mês: ${selectedMonth}`, 14, 28);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 33);

        // Table
        const tableColumn = ["Motorista", "Dias", "H. Totais", "H. Extra", "Salário Base", "Valor Extra", "TOTAL"];
        const tableRows = data.map(row => [
            row.driverName,
            row.daysWorked,
            row.totalHours + 'h',
            row.overtimeHours + 'h',
            row.baseSalary.toFixed(2) + '€',
            row.extraPay.toFixed(2) + '€',
            row.totalPay.toFixed(2) + '€'
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [16, 185, 129] }, // Emerald color
        });

        doc.save(`Horas_Motoristas_${selectedMonth}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-4">
                    <h2 className="text-white font-bold">Relatório Payroll</h2>
                    <span className="text-slate-400 text-sm font-mono bg-slate-900 px-2 py-1 rounded">{selectedMonth}</span>
                </div>

                <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Exportar PDF (Contabilidade)
                </button>
            </div>

            <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-[#0f172a]/80 text-slate-400 uppercase text-xs tracking-wider">
                        <tr>
                            <th className="p-4 font-bold border-b border-slate-700">Motorista</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-center">Dias Trab.</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-center">H. Totais</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-center text-amber-400">H. Extra</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-right">Base</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-right text-amber-400">Valor Extra</th>
                            <th className="p-4 font-bold border-b border-slate-700 text-right text-emerald-400">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {data.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">Sem dados para este mês.</td></tr>
                        ) : (
                            data.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-800/30">
                                    <td className="p-4 font-medium text-white">{row.driverName}</td>
                                    <td className="p-4 text-center">{row.daysWorked}</td>
                                    <td className="p-4 text-center font-mono">{row.totalHours}</td>
                                    <td className="p-4 text-center font-mono text-amber-400 font-bold">{row.overtimeHours}</td>
                                    <td className="p-4 text-right font-mono">{row.baseSalary.toFixed(2)}€</td>
                                    <td className="p-4 text-right font-mono text-amber-400">{row.extraPay.toFixed(2)}€</td>
                                    <td className="p-4 text-right font-mono font-bold text-emerald-400 text-lg">{row.totalPay.toFixed(2)}€</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
