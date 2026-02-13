import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Car, Download, Fuel, Wallet, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend
} from 'recharts';

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
    vehicleName: string;
    totalLiters: number;
    totalCost: number;
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
    route: string;
    issueType: string;
    description: string;
}

export default function PresetReportsView() {
    const [topDrivers, setTopDrivers] = useState<DriverReportItem[]>([]);
    const [vehicleStats, setVehicleStats] = useState<VehicleReportItem[]>([]);
    const [fuelStats, setFuelStats] = useState<FuelReportItem[]>([]);
    const [financialStats, setFinancialStats] = useState<FinancialReportItem[]>([]);
    const [evaIncidents, setEvaIncidents] = useState<EvaIncidentItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Parallel data fetching
                const [
                    { data: drivers },
                    { data: vehicles },
                    { data: fuel },
                    { data: invoices },
                    { data: evaDays }
                ] = await Promise.all([
                    supabase.from('motoristas').select('id, nome, status, servicos(count)'),
                    supabase.from('viaturas').select('id, matricula, marca, modelo, estado, manutencoes(count)'),
                    supabase.from('fuel_transactions').select('*').order('timestamp', { ascending: false }),
                    supabase.from('faturas').select('*').order('data', { ascending: false }).limit(10),
                    supabase.from('eva_transport_days').select('*, eva_transports(route)').eq('has_issue', true).order('date', { ascending: false }).limit(10)
                ]);

                // Process Drivers
                const processedDrivers = (drivers || []).map((d: any) => ({
                    id: d.id,
                    nome: d.nome,
                    status: d.status || 'indisponivel',
                    servicesCount: d.servicos?.[0]?.count || 0
                })).sort((a: any, b: any) => b.servicesCount - a.servicesCount).slice(0, 10);
                setTopDrivers(processedDrivers);

                // Process Vehicles
                const processedVehicles = (vehicles || []).map((v: any) => ({
                    id: v.id,
                    matricula: v.matricula,
                    marca: v.marca,
                    modelo: v.modelo,
                    status: v.estado || 'disponivel',
                    maintenanceCount: v.manutencoes?.[0]?.count || 0
                })).sort((a: any, b: any) => b.maintenanceCount - a.maintenanceCount).slice(0, 10);
                setVehicleStats(processedVehicles);

                // Process Fuel
                const fuelMap = new Map<string, FuelReportItem>();
                (fuel || []).forEach((t: any) => {
                    const existing = fuelMap.get(t.vehicle_id) || {
                        vehicleId: t.vehicle_id,
                        vehicleName: t.vehicle_id,
                        totalLiters: 0,
                        totalCost: 0
                    };
                    existing.totalLiters += Number(t.liters || 0);
                    existing.totalCost += Number(t.total_cost || 0);
                    fuelMap.set(t.vehicle_id, existing);
                });

                const vehicleLookup = new Map((vehicles || []).map((v: any) => [v.id, `${v.marca} ${v.modelo} (${v.matricula})`]));

                const processedFuel = Array.from(fuelMap.values()).map(f => ({
                    ...f,
                    vehicleName: vehicleLookup.get(f.vehicleId) || f.vehicleId
                })).sort((a, b) => b.totalCost - a.totalCost).slice(0, 5);
                setFuelStats(processedFuel);

                // Process Financial
                setFinancialStats((invoices || []).map((i: any) => ({
                    id: i.id,
                    numero: i.numero,
                    cliente: i.cliente_id,
                    total: i.total,
                    status: i.status,
                    data: i.data
                })));

                // Process EVA
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
            headStyles: { fillColor: [59, 130, 246], textColor: 255 }
        });

        doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    if (loading) return <div className="p-8 text-center text-slate-400 animate-pulse">A carregar relatórios rápidos...</div>;

    return (
        <div className="space-y-8 animate-fade-in pb-10">

            {/* Top Row: Drivers & Vehicles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 1. Drivers Section */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-400" /> Top Motoristas
                            </h3>
                            <p className="text-xs text-slate-400">Por volume de serviços realizados</p>
                        </div>
                        <button
                            onClick={() => exportToPDF("Top Motoristas", ["Nome", "Status", "Serviços"], topDrivers.map(d => [d.nome, d.status, d.servicesCount]))}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors shadow-sm"
                        >
                            <Download className="w-3 h-3" /> PDF
                        </button>
                    </div>

                    {/* Chart */}
                    <div className="h-48 mb-4 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topDrivers.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                                <YAxis dataKey="nome" type="category" width={80} stroke="#94a3b8" fontSize={10} tick={{ fill: '#94a3b8' }} />
                                <Tooltip cursor={{ fill: '#334155', opacity: 0.2 }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                                <Bar dataKey="servicesCount" name="Serviços" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto custom-scrollbar rounded-lg border border-slate-700/50">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-semibold tracking-wider">Nome</th>
                                    <th className="px-4 py-3 text-right font-semibold tracking-wider">Total Svcs.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {topDrivers.map((driver) => (
                                    <tr key={driver.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-2.5 text-white font-medium">{driver.nome}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-blue-400 bg-blue-500/5">{driver.servicesCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Vehicles Section */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Car className="w-5 h-5 text-indigo-400" /> Frota (Manutenções)
                            </h3>
                            <p className="text-xs text-slate-400">Veículos com maior nº de intervenções</p>
                        </div>
                        <button
                            onClick={() => exportToPDF("Estado da Frota", ["Matrícula", "Modelo", "Status", "Manutenções"], vehicleStats.map(v => [v.matricula, `${v.marca} ${v.modelo}`, v.status, v.maintenanceCount]))}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors shadow-sm"
                        >
                            <Download className="w-3 h-3" /> PDF
                        </button>
                    </div>

                    {/* Chart - Simple Distribution of Status for variety */}
                    <div className="h-48 mb-4 w-full flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Em Manutenção', value: vehicleStats.filter(v => v.maintenanceCount > 0).length },
                                        { name: 'Operacional', value: vehicleStats.length - vehicleStats.filter(v => v.maintenanceCount > 0).length }
                                    ]}
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#ef4444" />
                                    <Cell fill="#10b981" />
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar rounded-lg border border-slate-700/50">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Viatura</th>
                                    <th className="px-4 py-3 text-right font-semibold">Interv.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {vehicleStats.map((vehicle) => (
                                    <tr key={vehicle.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-2.5 text-white">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{vehicle.matricula}</span>
                                                <span className="text-[10px] text-slate-500">{vehicle.marca} {vehicle.modelo}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-amber-500 bg-amber-500/5">{vehicle.maintenanceCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 3. Fuel Analysis */}
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Fuel className="w-5 h-5 text-amber-500" /> Top Consumo
                            </h3>
                            <p className="text-xs text-slate-400">Maiores gastos por viatura (Global)</p>
                        </div>
                        <button
                            onClick={() => exportToPDF("Consumo de Combustivel", ["Viatura", "Litros", "Custo Total"], fuelStats.map(f => [f.vehicleName, f.totalLiters + ' L', formatCurrency(f.totalCost)]))}
                            className="text-xs flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors shadow-sm"
                        >
                            <Download className="w-3 h-3" /> PDF
                        </button>
                    </div>

                    <div className="h-40 mb-6 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fuelStats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="vehicleName" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val.split('(')[0].substring(0, 10) + '...'} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `€${val}`} />
                                <Tooltip cursor={{ fill: '#334155', opacity: 0.2 }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                                <Bar dataKey="totalCost" name="Custo (€)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-700/50">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900/80 text-xs uppercase font-medium text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Viatura</th>
                                    <th className="px-4 py-3 text-right">Litros</th>
                                    <th className="px-4 py-3 text-right">Custo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {fuelStats.length > 0 ? fuelStats.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 text-white text-xs font-medium">{item.vehicleName}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-400">{item.totalLiters.toFixed(0)} L</td>
                                        <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">{formatCurrency(item.totalCost)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={3} className="p-8 text-center text-slate-500 text-xs italic">Sem dados de abastecimento.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Financial & EVA */}
                <div className="space-y-8">
                    {/* Financial */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-emerald-500" /> Finanças Recentes
                            </h3>
                            <button onClick={() => exportToPDF("Resumo Financeiro", ["Fatura", "Data", "Valor", "Status"], financialStats.map(f => [f.numero, f.data, formatCurrency(f.total), f.status]))} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">PDF</button>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-slate-700/50 max-h-[200px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm text-xs uppercase font-medium text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3">Fatura</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {financialStats.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-2 text-white text-xs">
                                                {item.numero} <span className="text-slate-500 ml-1">{item.data}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-white">{formatCurrency(item.total)}</td>
                                            <td className="px-4 py-2 text-right">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.status === 'paga' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* EVA */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" /> Ocorrências EVA
                            </h3>
                            <button onClick={() => exportToPDF("Incidentes EVA", ["Data", "Rota", "Tipo", "Desc."], evaIncidents.map(i => [i.date, i.route, i.issueType, i.description]))} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">PDF</button>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-slate-700/50 max-h-[200px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-sm text-xs uppercase font-medium text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3">Rota / Data</th>
                                        <th className="px-4 py-3">Descrição</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {evaIncidents.length > 0 ? evaIncidents.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-2 text-white text-xs">
                                                <div className="font-medium">{item.route}</div>
                                                <div className="text-slate-500">{item.date}</div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="text-red-400 text-xs font-bold block">{item.issueType}</span>
                                                <span className="text-slate-500 text-[10px] block truncate max-w-[200px]">{item.description}</span>
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
