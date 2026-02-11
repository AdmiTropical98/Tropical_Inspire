import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, FileSpreadsheet, Search, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ReportType =
    | 'motoristas'
    | 'viaturas'
    | 'servicos'
    | 'manutencoes'
    | 'fuel_transactions'
    | 'tank_refills'
    | 'faturas'
    | 'eva_transports'
    | 'centros_custos';

import type { FuelTransaction } from '../../types';

export default function CustomReportBuilder() {
    const [reportType, setReportType] = useState<ReportType>('motoristas');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [generatedData, setGeneratedData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        setGeneratedData([]);

        try {
            let data: any[] = [];

            if (reportType === 'fuel_transactions') {
                // 1. Fetch Transactions
                let query = supabase.from('fuel_transactions').select('*');

                if (startDate && endDate) {
                    query = query.gte('timestamp', startDate).lte('timestamp', endDate);
                }

                const { data: transactions, error: txError } = await query;
                if (txError) throw txError;

                // 2. Fetch Related Data in Parallel
                const [
                    { data: viaturas },
                    { data: motoristas },
                    { data: centros }
                ] = await Promise.all([
                    supabase.from('viaturas').select('id, matricula, marca, modelo'),
                    supabase.from('motoristas').select('id, nome'),
                    supabase.from('centros_custos').select('id, nome')
                ]);

                // 3. Map IDs to Names & Format Data
                data = (transactions || []).map((tx: FuelTransaction) => {
                    const vehicle = viaturas?.find(v => v.id === tx.vehicleId || v.id === tx.vehicle_id); // Support both cases
                    const driver = motoristas?.find(m => m.id === tx.driverId || m.id === tx.driver_id);
                    const cc = centros?.find(c => c.id === tx.centroCustoId || c.id === tx.centro_custo_id);

                    // Normalize vehicle ID lookup effectively
                    let vehicleDisplay = tx.vehicleId || tx.vehicle_id;
                    if (vehicle) {
                        vehicleDisplay = `${vehicle.matricula} (${vehicle.marca} ${vehicle.modelo})`;
                    }

                    return {
                        'Data': new Date(tx.timestamp).toLocaleString('pt-PT'),
                        'Viatura': vehicleDisplay,
                        'Condutor': driver ? driver.nome : (tx.driver_id || 'N/A'),
                        'Fonte': (tx.isExternal || tx.is_external) ? 'Importado BP' : 'Abastecido na Oficina',
                        'Litros': tx.liters,
                        'KM': tx.km,
                        'Preço/L': tx.pricePerLiter || tx.price_per_liter ? `${Number(tx.pricePerLiter || tx.price_per_liter).toFixed(3)} €` : '-',
                        'Total': tx.totalCost || tx.total_cost ? `${Number(tx.totalCost || tx.total_cost).toFixed(2)} €` : '-',
                        'Centro Custo': cc ? cc.nome : (tx.centroCustoId || tx.centro_custo_id || 'Sem Centro de Custo'), // Normalized fallback
                        'Registado Por': tx.staffName || tx.staff_name || 'Sistema',
                        'Estado': tx.status === 'confirmed' ? 'Confirmado' : 'Pendente',
                        'Posto': tx.isExternal ? (tx.station || 'Externo/BP') : 'Interno',
                    };
                });

                // SORT BY COST CENTER THEN DATE
                data.sort((a, b) => {
                    const ccA = (a['Centro Custo'] || '').toString().toLowerCase();
                    const ccB = (b['Centro Custo'] || '').toString().toLowerCase();
                    if (ccA < ccB) return -1;
                    if (ccA > ccB) return 1;
                    // Secondary sort by date (descending)
                    return new Date(b['Data']).getTime() - new Date(a['Data']).getTime();
                });

            } else {
                // Standard Logic for other reports
                let query = supabase.from(reportType).select('*');

                // Apply Date Filters
                if (startDate && endDate) {
                    switch (reportType) {
                        case 'manutencoes':
                            query = query.gte('data', startDate).lte('data', endDate);
                            break;
                        case 'tank_refills':
                            query = query.gte('timestamp', startDate).lte('timestamp', endDate);
                            break;
                        case 'faturas':
                            query = query.gte('data', startDate).lte('data', endDate);
                            break;
                        case 'eva_transports':
                            query = query.gte('reference_date', startDate).lte('reference_date', endDate);
                            break;
                        default:
                            break;
                    }
                }

                const { data: resData, error: resError } = await query;
                if (resError) throw resError;
                data = resData || [];
            }

            setGeneratedData(data);

        } catch (err) {
            console.error('Error generating custom report:', err);
            alert('Erro ao gerar relatório. Verifique a consola.');
        } finally {
            setLoading(false);
        }
    };

    const exportPDF = () => {
        if (!generatedData.length) return;
        // Landscape orientation for wider tables
        const doc = new jsPDF('l', 'mm', 'a4');
        const title = `Relatório de ${reportType.toUpperCase()}`;

        doc.setFontSize(16);
        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 22);

        let finalY = 25; // Start Y position

        if (reportType === 'fuel_transactions') {
            // 1. Sort Data by Cost Center
            const sortedData = [...generatedData].sort((a, b) => {
                const ccA = (a['Centro Custo'] || '').toString().toLowerCase();
                const ccB = (b['Centro Custo'] || '').toString().toLowerCase();
                if (ccA < ccB) return -1;
                if (ccA > ccB) return 1;
                return new Date(b['Data']).getTime() - new Date(a['Data']).getTime();
            });

            // 2. Prepare Table Body with Group Headers and Subtotals
            const body: any[] = [];
            let currentCC = '';
            let groupTotal = 0;

            const headers = Object.keys(sortedData[0]).filter(k =>
                typeof sortedData[0][k] !== 'object' && k !== 'foto' && k !== 'pdfUrl' && k !== 'Centro Custo'
            );

            sortedData.forEach((item, index) => {
                const itemCC = item['Centro Custo'] || 'Sem Centro de Custo';

                // New Group Detected
                if (itemCC !== currentCC) {
                    // Close previous group if exists
                    if (currentCC !== '') {
                        // Add Subtotal Row
                        body.push([
                            { content: 'TOTAL DO CENTRO DE CUSTO', colSpan: headers.length - 1, styles: { halign: 'right', fontStyle: 'bold', fillColor: [245, 245, 245] } },
                            { content: `${groupTotal.toFixed(2)} €`, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }
                        ]);
                    }

                    // Start new group
                    currentCC = itemCC;
                    groupTotal = 0;

                    // Add Group Header Row
                    body.push([{
                        content: `Centro de Custo: ${currentCC}`,
                        colSpan: headers.length,
                        styles: { fontStyle: 'bold', fillColor: [220, 220, 230], textColor: [20, 20, 60] }
                    }]);
                }

                // Add Data Row
                const row = headers.map(h => {
                    const val = item[h];
                    return val === undefined || val === null ? '' : String(val).substring(0, 50);
                });
                body.push(row);

                // Accumulate Total
                const valStr = String(item['Total'] || '0').replace(' €', '').replace(',', '.');
                const val = parseFloat(valStr);
                groupTotal += (isNaN(val) ? 0 : val);

                // Handle Last Item
                if (index === sortedData.length - 1) {
                    body.push([
                        { content: 'TOTAL DO CENTRO DE CUSTO', colSpan: headers.length - 1, styles: { halign: 'right', fontStyle: 'bold', fillColor: [245, 245, 245] } },
                        { content: `${groupTotal.toFixed(2)} €`, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }
                    ]);
                }
            });

            autoTable(doc, {
                head: [headers],
                body: body,
                startY: finalY + 10,
                styles: { fontSize: 8, cellWidth: 'wrap' },
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }
            });

        } else {
            // Standard Logic for other reports
            const headers = Object.keys(generatedData[0]).filter(k =>
                typeof generatedData[0][k] !== 'object' && k !== 'foto' && k !== 'pdfUrl'
            );

            const rows = generatedData.map(item => headers.map(h => {
                const val = item[h];
                return val === undefined || val === null ? '' : String(val).substring(0, 50);
            }));

            autoTable(doc, {
                head: [headers],
                body: rows,
                startY: 35,
                styles: { fontSize: 8, cellWidth: 'wrap' },
                theme: 'grid'
            });
        }

        doc.save(`report_${reportType}_${new Date().getTime()}.pdf`);
    };

    const exportExcel = () => {
        if (!generatedData.length) return;
        const ws = XLSX.utils.json_to_sheet(generatedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `report_${reportType}_${new Date().getTime()}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Search className="w-5 h-5 text-blue-400" /> Construtor de Relatórios
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    {/* Report Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">Tipo de Dados</label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="motoristas">Motoristas</option>
                            <option value="viaturas">Viaturas</option>
                            <option value="servicos">Serviços / Viagens</option>
                            <option value="manutencoes">Manutenções</option>
                            <option disabled>--- Combustível ---</option>
                            <option value="fuel_transactions">Abastecimentos</option>
                            <option value="tank_refills">Reabastecimentos (Tanque)</option>
                            <option disabled>--- Financeiro ---</option>
                            <option value="faturas">Faturas</option>
                            <option value="centros_custos">Centros de Custo</option>
                            <option disabled>--- Transportes EVA ---</option>
                            <option value="eva_transports">Serviços EVA</option>
                        </select>
                    </div>

                    {/* Dates (Optional depending on type) */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">De (Opcional)</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">Até (Opcional)</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? 'A processar...' : 'Gerar Tabela'}
                    </button>
                </div>
            </div>

            {/* Results Area */}
            {generatedData.length > 0 && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">{generatedData.length} registos encontrados</span>
                        <div className="flex gap-2">
                            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-sm transition-colors">
                                <Download className="w-4 h-4" /> PDF
                            </button>
                            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-sm transition-colors">
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-x-auto max-h-[500px] custom-scrollbar">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm z-10 text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    {Object.keys(generatedData[0]).filter(k => typeof generatedData[0][k] !== 'object' && k !== 'foto' && k !== 'pdfUrl').map(key => (
                                        <th key={key} className="px-6 py-3 whitespace-nowrap">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {generatedData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30">
                                        {Object.keys(item).filter(k => typeof item[k] !== 'object' && k !== 'foto' && k !== 'pdfUrl').map(key => (
                                            <td key={key} className="px-6 py-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                                {String(item[key] ?? '-')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
