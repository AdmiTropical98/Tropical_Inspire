import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Car, Download, FileText } from 'lucide-react';
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

export default function PresetReportsView() {
    const [topDrivers, setTopDrivers] = useState<DriverReportItem[]>([]);
    const [vehicleStats, setVehicleStats] = useState<VehicleReportItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Drivers
                const { data: drivers } = await supabase
                    .from('motoristas')
                    .select('id, nome, status, servicos(count)');

                // Fetch Vehicles & their Maintenance count
                const { data: vehicles } = await supabase
                    .from('viaturas')
                    .select('id, matricula, marca, modelo, estado, manutencoes(count)');

                // Process Drivers
                const processedDrivers = (drivers || []).map((d: any) => ({
                    id: d.id,
                    nome: d.nome,
                    status: d.status || 'indisponivel',
                    servicesCount: d.servicos?.[0]?.count || 0 // Supabase returns array of objects for count
                })).sort((a, b) => b.servicesCount - a.servicesCount).slice(0, 10); // Top 10

                // Process Vehicles
                const processedVehicles = (vehicles || []).map((v: any) => ({
                    id: v.id,
                    matricula: v.matricula,
                    marca: v.marca,
                    modelo: v.modelo,
                    status: v.estado || 'disponivel',
                    maintenanceCount: v.manutencoes?.[0]?.count || 0
                })).sort((a, b) => b.maintenanceCount - a.maintenanceCount).slice(0, 10);

                setTopDrivers(processedDrivers);
                setVehicleStats(processedVehicles);

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

        autoTable(doc, {
            head: [headers],
            body: data,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });

        doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    };

    if (loading) return <div className="p-8 text-center text-slate-400">A carregar relatórios rápidos...</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Drivers Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-400" /> Top 10 Motoristas (Por Serviços)
                    </h3>
                    <button
                        onClick={() => exportToPDF("Relatório de Motoristas", ["Nome", "Status", "Serviços"], topDrivers.map(d => [d.nome, d.status, d.servicesCount]))}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
                    >
                        <Download className="w-4 h-4" /> Exportar PDF
                    </button>
                </div>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400">
                            <tr>
                                <th className="px-6 py-3">Nome</th>
                                <th className="px-6 py-3">Status Atual</th>
                                <th className="px-6 py-3 text-right">Serviços Totais</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {topDrivers.length > 0 ? topDrivers.map((driver) => (
                                <tr key={driver.id} className="hover:bg-slate-700/30">
                                    <td className="px-6 py-3 font-medium text-white">{driver.nome}</td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-0.5 rounded textxs ${driver.status === 'ocupado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                            {driver.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono">{driver.servicesCount}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-500">Sem dados disponíveis.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Vehicles Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Car className="w-5 h-5 text-indigo-400" /> Estado da Frota (Por Manutenções)
                    </h3>
                    <button
                        onClick={() => exportToPDF("Relatório de Viaturas", ["Matrícula", "Marca/Modelo", "Status", "Manutenções"], vehicleStats.map(v => [v.matricula, `${v.marca} ${v.modelo}`, v.status, v.maintenanceCount]))}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
                    >
                        <Download className="w-4 h-4" /> Exportar PDF
                    </button>
                </div>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-400">
                            <tr>
                                <th className="px-6 py-3">Matrícula</th>
                                <th className="px-6 py-3">Marca / Modelo</th>
                                <th className="px-6 py-3">Estado</th>
                                <th className="px-6 py-3 text-right">Intervenções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {vehicleStats.length > 0 ? vehicleStats.map((vehicle) => (
                                <tr key={vehicle.id} className="hover:bg-slate-700/30">
                                    <td className="px-6 py-3 font-mono text-white">{vehicle.matricula}</td>
                                    <td className="px-6 py-3">{vehicle.marca} {vehicle.modelo}</td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-0.5 rounded textxs ${vehicle.status === 'em_manutencao' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            {vehicle.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono">{vehicle.maintenanceCount}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="px-6 py-4 text-center text-slate-500">Sem dados disponíveis.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
