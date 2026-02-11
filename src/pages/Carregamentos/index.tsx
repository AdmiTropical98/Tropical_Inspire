/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
    Zap, Plus, Search,
    MapPin, DollarSign, Truck, User,
    Trash2, TrendingUp, BatteryCharging, Building
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { ElectricChargingRecord } from '../../types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function Carregamentos() {
    const { viaturas, motoristas, centrosCustos } = useWorkshop();
    const [records, setRecords] = useState<ElectricChargingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVehicle, setFilterVehicle] = useState('all');

    // Form State
    const [formData, setFormData] = useState({
        vehicle_id: '',
        driver_id: '',
        cost_center_id: '',
        station_name: '',
        date: '',
        kwh: '',
        cost: '',
        duration: ''
    });
    const [importing, setImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('electric_charging_records')
                .select(`
                    *,
                    vehicle:viaturas(id, matricula, marca, modelo),
                    driver:motoristas(id, nome),
                    cost_center:centros_custos(id, nome)
                `)
                .order('date', { ascending: false });

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Error fetching records:', error);
            toast.error('Erro ao carregar carregamentos');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const { error } = await supabase.from('electric_charging_records').insert([{
                vehicle_id: formData.vehicle_id,
                driver_id: formData.driver_id || null,
                cost_center_id: formData.cost_center_id || null,
                station_name: formData.station_name,
                date: formData.date,
                kwh: parseFloat(formData.kwh),
                cost: parseFloat(formData.cost),
                duration: parseFloat(formData.duration || '0'),
                created_by: (await supabase.auth.getUser()).data.user?.id
            }]);

            if (error) throw error;

            toast.success('Carregamento registado com sucesso!');
            setShowModal(false);
            setFormData({
                vehicle_id: '',
                driver_id: '',
                cost_center_id: '',
                station_name: '',
                date: '',
                kwh: '',
                cost: '',
                duration: ''
            });
            fetchRecords();
        } catch (error) {
            console.error('Error saving record:', error);
            toast.error('Erro ao guardar registo');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem a certeza que deseja eliminar este registo?')) return;

        try {
            const { error } = await supabase
                .from('electric_charging_records')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Registo eliminado');
            fetchRecords();
        } catch (error) {
            console.error('Error deleting record:', error);
            toast.error('Erro ao eliminar');
        }
    };

    // --- BULK IMPORT LOGIC ---
    const handleDownloadTemplate = () => {
        const headers = [
            'Matricula',
            'Data',         // YYYY-MM-DD HH:MM
            'Estacao',
            'kWh',
            'Custo',
            'Duracao (min)',
            'Motorista (Opcional)',
            'Centro Custo (Opcional)' // Name of CC
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'Carregamentos_Template.xlsx');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast.error('O ficheiro está vazio.');
                    setImporting(false);
                    return;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const recordsToInsert: any[] = [];
                let successCount = 0;
                let failCount = 0;

                // Pre-process vehicles
                const vehicleMap = new Map();
                viaturas.forEach(v => {
                    const normalized = v.matricula.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    vehicleMap.set(normalized, v.id);
                });

                // Pre-process drivers
                const driverMap = new Map();
                motoristas.forEach(d => {
                    driverMap.set(d.nome.toLowerCase(), d.id);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ((d as any).nif) driverMap.set(String((d as any).nif), d.id);
                });

                // Pre-process cost centers
                const ccMap = new Map();
                centrosCustos.forEach(c => {
                    ccMap.set(c.nome.toLowerCase(), c.id);
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const row of data as any[]) {
                    const plateRaw = row['Matricula'] || '';
                    const plateNorm = plateRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const vehicleId = vehicleMap.get(plateNorm);

                    if (!vehicleId) {
                        failCount++;
                        continue;
                    }

                    let driverId = null;
                    const driverRaw = row['Motorista (Opcional)'] ? String(row['Motorista (Opcional)']) : '';
                    if (driverRaw) driverId = driverMap.get(driverRaw.toLowerCase()) || null;

                    let costCenterId = null;
                    const ccRaw = row['Centro Custo (Opcional)'] ? String(row['Centro Custo (Opcional)']) : '';
                    if (ccRaw) costCenterId = ccMap.get(ccRaw.toLowerCase()) || null;

                    // Date Parsing (Assuming text or Excel serial)
                    const dateRaw = row['Data'];
                    // Simple fallback if string
                    let dateIso = dateRaw;
                    if (typeof dateRaw === 'string' && !dateRaw.includes('T')) {
                        dateIso = new Date(dateRaw).toISOString();
                    }

                    recordsToInsert.push({
                        vehicle_id: vehicleId,
                        driver_id: driverId,
                        cost_center_id: costCenterId,
                        station_name: row['Estacao'] || 'Desconhecido',
                        date: dateIso,
                        kwh: parseFloat(row['kWh'] || '0'),
                        cost: parseFloat(row['Custo'] || '0'),
                        duration: parseFloat(row['Duracao (min)'] || '0'),
                        created_by: (await supabase.auth.getUser()).data.user?.id
                    });
                    successCount++;
                }

                if (recordsToInsert.length > 0) {
                    const { error } = await supabase.from('electric_charging_records').insert(recordsToInsert);
                    if (error) throw error;
                    toast.success(`${successCount} registos importados!`);
                    if (failCount > 0) toast(`${failCount} ignorados (viatura não encontrada).`, { icon: '⚠️' });
                    fetchRecords();
                } else {
                    toast.error('Nenhum registo válido.');
                }
            } catch (error) {
                console.error('Import error:', error);
                toast.error('Erro ao processar ficheiro.');
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // Filter Logic
    const filteredRecords = records.filter(r => {
        const matchesSearch =
            r.station_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.vehicle?.matricula || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesVehicle = filterVehicle === 'all' || r.vehicle_id === filterVehicle;
        return matchesSearch && matchesVehicle;
    });

    // Stats
    const totalCost = filteredRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const totalKwh = filteredRecords.reduce((sum, r) => sum + (Number(r.kwh) || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <BatteryCharging className="w-6 h-6 text-blue-500" />
                        </div>
                        Carregamentos Elétricos
                    </h1>
                    <p className="text-slate-400 mt-1">Gestão de consumos e custos de carregamento</p>
                </div>

                <div className="flex gap-2">
                    <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-medium transition-all">
                        <TrendingUp className="w-4 h-4 rotate-180" /> Template
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50">
                        {importing ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : <Truck className="w-4 h-4" />}
                        Importar
                    </button>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95">
                        <Plus className="w-5 h-5" /> Novo Registo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Custo Total</p>
                            <h3 className="text-2xl font-bold text-white mt-2">{totalCost.toFixed(2)} €</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-lg"><DollarSign className="w-6 h-6 text-emerald-500" /></div>
                    </div>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Total Energia</p>
                            <h3 className="text-2xl font-bold text-white mt-2">{totalKwh.toFixed(1)} kWh</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-lg"><Zap className="w-6 h-6 text-blue-500" /></div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Pesquisar estação ou matrícula..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div className="w-full md:w-64">
                    <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                        <option value="all">Todas as Viaturas</option>
                        {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium">
                            <tr>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Viatura</th>
                                <th className="px-6 py-4">Estação / CC</th>
                                <th className="px-6 py-4">Energia</th>
                                <th className="px-6 py-4 text-right">Custo</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Carregando...</td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Sem registos.</td></tr>
                            ) : (
                                filteredRecords.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{new Date(r.date).toLocaleDateString()}</span>
                                                <span className="text-slate-400 text-xs">{new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="block text-white font-medium">{r.vehicle?.matricula}</span>
                                            <span className="text-slate-400 text-xs">{r.driver?.nome || 'Sem condutor'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="block text-white">{r.station_name}</span>
                                            {r.cost_center && (
                                                <div className="flex items-center gap-1 text-xs text-orange-400 mt-1">
                                                    <Building className="w-3 h-3" />
                                                    {r.cost_center.nome}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="block text-white">{r.kwh} kWh</span>
                                            <span className="text-slate-400 text-xs">{r.duration} min</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-400">{r.cost.toFixed(2)} €</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-blue-500" /> Novo Carregamento
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <Trash2 className="w-5 h-5 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Viatura</label>
                                    <select required value={formData.vehicle_id} onChange={e => setFormData({ ...formData, vehicle_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500">
                                        <option value="">Selecione...</option>
                                        {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Motorista (Opcional)</label>
                                    <select value={formData.driver_id} onChange={e => setFormData({ ...formData, driver_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500">
                                        <option value="">Sem Motorista</option>
                                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Centro de Custo (Opcional)</label>
                                    <select value={formData.cost_center_id} onChange={e => setFormData({ ...formData, cost_center_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500">
                                        <option value="">Nenhum</option>
                                        {centrosCustos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Data/Hora</label>
                                    <input type="datetime-local" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Estação</label>
                                    <input type="text" required value={formData.station_name} onChange={e => setFormData({ ...formData, station_name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">kWh</label>
                                    <input type="number" step="0.01" required value={formData.kwh} onChange={e => setFormData({ ...formData, kwh: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Custo (€)</label>
                                    <input type="number" step="0.01" required value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Duração (min)</label>
                                    <input type="number" step="1" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                    {submitting ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : <Zap className="w-4 h-4" />}
                                    Registar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
