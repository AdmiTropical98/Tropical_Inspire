import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Car, Download, Fuel, Wallet, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DriverReportItem {
    id: string;
    nome: string;
    servicesCount: number;
    status: string;
}

interface VehicleReportItem {
    id: string;
    matricula: string;
    marca: string;
    modelo: string;
    maintenanceCount: number;
    status: string;
}

interface FuelReportItem {
    vehicleId: string;
    vehicleName: string; // derived from cache or transactions if available
    totalLiters: number;
    totalCost: number;
    avgConsumption?: number;
}

interface FinancialReportItem {
    id: string;
    numero: string;
    cliente: string;
    total: number;
    status: string;
    data: string;
}

interface EvaIncidentItem {
    id: string;
    date: string;
    route: string; // Joined from eva_transports
    issueType: string;
    description: string;
}

export default function PresetReportsView() {
    // Existing State
    const [topDrivers, setTopDrivers] = useState<DriverReportItem[]>([]);
    const [vehicleStats, setVehicleStats] = useState<VehicleReportItem[]>([]);

    // New State
    const [fuelStats, setFuelStats] = useState<FuelReportItem[]>([]);
    const [financialStats, setFinancialStats] = useState<FinancialReportItem[]>([]);
    const [evaIncidents, setEvaIncidents] = useState<EvaIncidentItem[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Drivers & Vehicles (Existing)
                const { data: drivers } = await supabase.from('motoristas').select('id, nome, status, servicos(count)');
                const { data: vehicles } = await supabase.from('viaturas').select('id, matricula, marca, modelo, estado, manutencoes(count)');

                // 2. Fetch Fuel Transactions
                const { data: fuel } = await supabase.from('fuel_transactions').select('*').order('timestamp', { ascending: false });

                // 3. Fetch Invoices (Financial)
                const { data: invoices } = await supabase.from('faturas').select('*').order('data', { ascending: false }).limit(10);

                // 4. Fetch EVA Incidents
                const { data: evaDays } = await supabase.from('eva_transport_days')
                    .select('*, eva_transports(route)')
                    .eq('has_issue', true)
                    .order('date', { ascending: false })
                    .limit(10);


                // --- PROCESS DATA ---

                // Drivers
                setTopDrivers((drivers || []).map((d: any) => ({
                    id: d.id,
                    nome: d.nome,
                    status: d.status || 'indisponivel',
                    servicesCount: d.servicos?.[0]?.count || 0
                })).sort((a: any, b: any) => b.servicesCount - a.servicesCount).slice(0, 10));

                // Vehicles
                setVehicleStats((vehicles || []).map((v: any) => ({
                    id: v.id,
                    matricula: v.matricula,
                    marca: v.marca,
                    modelo: v.modelo,
                    status: v.estado || 'disponivel',
                    maintenanceCount: v.manutencoes?.[0]?.count || 0
                })).sort((a: any, b: any) => b.maintenanceCount - a.maintenanceCount).slice(0, 10));

                // Fuel Analysis (Group by Vehicle)
                const fuelMap = new Map<string, FuelReportItem>();
                (fuel || []).forEach((t: any) => {
                    const existing = fuelMap.get(t.vehicle_id) || {
                        vehicleId: t.vehicle_id,
                        vehicleName: t.vehicle_id, // Placeholder, would need join or context lookup
                        totalLiters: 0,
                        totalCost: 0
                    };
                    existing.totalLiters += Number(t.liters || 0);
                    existing.totalCost += Number(t.total_cost || 0);
                    fuelMap.set(t.vehicle_id, existing);
                });

                // Try to resolve vehicle names from the vehicles list we just fetched
                const vehicleLookup = new Map((vehicles || []).map((v: any) => [v.id, `${v.marca} ${v.modelo} (${v.matricula})`]));

                const processedFuel = Array.from(fuelMap.values()).map(f => ({
                    ...f,
                    vehicleName: vehicleLookup.get(f.vehicleId) || f.vehicleId
                })).sort((a, b) => b.totalCost - a.totalCost).slice(0, 5); // Top 5 Spenders
                setFuelStats(processedFuel);

                // Financial
                setFinancialStats((invoices || []).map((i: any) => ({
                    id: i.id,
                    numero: i.numero,
                    cliente: i.cliente_id, // Ideally fetch name, but ID OK for summary
                    total: i.total,
                    status: i.status,
                    data: i.data
                })));

                // EVA
                setEvaIncidents((evaDays || []).map((d: any) => ({
                    id: d.id,
                    date: d.date,
                    route: d.eva_transports?.route || 'Rota Desconhecida',
                    issueType: d.issue_type,
                    description: d.issue_description
                })));

            } catch (err) {
                console.error('Error loading preset reports:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const exportToPDF = (title: string, headers: string[], data: any[]) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 28);

        autoTable(doc, {
            head: [headers],
            body: data,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });

        doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    if (loading) return <div className="p-8 text-center text-slate-400 animate-pulse">A carregar relatórios rápidos...</div>;

    return (
        <div className="space-y-8 animate-fade-in pb-10">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Drivers Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-400" /> Top Motoristas
                        </h3>
                        <button
                            onClick={() => exportToPDF("Top Motoristas", ["Nome", "Status", "Serviços"], topDrivers.map(d => [d.nome, d.status, d.servicesCount]))}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                        >
                            <Download className="w-3 h-3" /> PDF
                        </button>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Nome</th>
                                    <th className="px-4 py-3 text-right">Serviços</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {topDrivers.map((driver) => (
                                    <tr key={driver.id} className="hover:bg-slate-700/30">
                                        <td className="px-4 py-3 text-white">{driver.nome}</td>
                                        <td className="px-4 py-3 text-right font-mono text-blue-400">{driver.servicesCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Vehicles Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Car className="w-5 h-5 text-indigo-400" /> Frota (Manutenções)
                        </h3>
                        <button
                            onClick={() => exportToPDF("Estado da Frota", ["Matrícula", "Modelo", "Status", "Manutenções"], vehicleStats.map(v => [v.matricula, `${v.marca} ${v.modelo}`, v.status, v.maintenanceCount]))}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                        >
                            <Download className="w-3 h-3" /> PDF
                        </button>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Viatura</th>
                                    <th className="px-4 py-3 text-right">Interv.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {vehicleStats.map((vehicle) => (
                                    <tr key={vehicle.id} className="hover:bg-slate-700/30">
                                        <td className="px-4 py-3 text-white">
                                            <div className="flex flex-col">
                                                <span>{vehicle.matricula}</span>
                                                <span className="text-xs text-slate-500">{vehicle.marca}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-amber-500">{vehicle.maintenanceCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 3. Fuel Analysis */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Fuel className="w-5 h-5 text-amber-500" /> Consumo (Top 5)
                        </h3>
                        <button
                            onClick={() => exportToPDF("Consumo de Combustivel", ["Viatura", "Litros", "Custo Total"], fuelStats.map(f => [f.vehicleName, f.totalLiters + ' L', formatCurrency(f.totalCost)]))}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                        >
                            <Download className="w-3 h-3" /> PDF
                        </button>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Viatura</th>
                                    <th className="px-4 py-3 text-right">Litros</th>
                                    <th className="px-4 py-3 text-right">Custo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {fuelStats.length > 0 ? fuelStats.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30">
                                        <td className="px-4 py-3 text-white text-xs">{item.vehicleName}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-400">{item.totalLiters.toFixed(0)} L</td>
                                        <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">{formatCurrency(item.totalCost)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={3} className="p-4 text-center text-slate-500 text-xs">Sem dados de abastecimento.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Financial & EVA (Split or Stacked? Stacked for now) */}
                <div className="space-y-8">
                    {/* Financial Reports */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-emerald-500" /> Finanças Recentes
                            </h3>
                            <button
                                onClick={() => exportToPDF("Resumo Financeiro", ["Fatura", "Data", "Valor", "Status"], financialStats.map(f => [f.numero, f.data, formatCurrency(f.total), f.status]))}
                                className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                            >
                                <Download className="w-3 h-3" /> PDF
                            </button>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden max-h-[200px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400 sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-4 py-3">Fatura</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {financialStats.length > 0 ? financialStats.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-3 text-white text-xs">
                                                {item.numero}
                                                <span className="block text-[10px] text-slate-500">{item.data}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-white">{formatCurrency(item.total)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-[10px] px-2 py-0.5 rounded ${item.status === 'paga' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="p-4 text-center text-slate-500 text-xs">Sem faturas recentes.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* EVA Incidents */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" /> Ocorrências EVA
                            </h3>
                            <button
                                onClick={() => exportToPDF("Incidentes EVA", ["Data", "Rota", "Tipo", "Desc."], evaIncidents.map(i => [i.date, i.route, i.issueType, i.description]))}
                                className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                            >
                                <Download className="w-3 h-3" /> PDF
                            </button>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden max-h-[200px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400 sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-4 py-3">Data / Rota</th>
                                        <th className="px-4 py-3">Incidente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {evaIncidents.length > 0 ? evaIncidents.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-3 text-white text-xs">
                                                <div className="font-medium">{item.date}</div>
                                                <div className="text-slate-500 truncate max-w-[120px]">{item.route}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-red-400 text-xs font-bold block">{item.issueType}</span>
                                                <span className="text-slate-500 text-[10px] block truncate max-w-[150px]" title={item.description}>
                                                    {item.description}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={2} className="p-4 text-center text-slate-500 text-xs">Sem registo de incidentes.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
