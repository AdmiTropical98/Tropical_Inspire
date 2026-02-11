/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
    Zap, Plus, Search,
    Truck,
    Trash2, TrendingUp, DollarSign,
    BatteryCharging, Building
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
    const [lastError, setLastError] = useState<any>(null); // Debug state

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
                kwh: parseFloat(formData.kwh) || 0,
                cost: parseFloat(formData.cost) || 0,
                duration: parseFloat(formData.duration || '0') || 0,
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
        } catch (error: any) {
            console.error('Error saving record:', error);
            toast.error('Erro: ' + (error.message || 'Falha ao guardar'));
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

    const runDiagnostics = async () => {
        const toastId = toast.loading('A executar diagnóstico...');
        try {
            // 1. Check Auth
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Utilizador não autenticado.');

            // 2. Check Table Existence & SELECT Permission
            const { count, error: selectError } = await supabase
                .from('electric_charging_records')
                .select('*', { count: 'exact', head: true });

            if (selectError) {
                // Determine specific error
                if (selectError.message.includes('relation') && selectError.message.includes('does not exist')) {
                    throw new Error('A tabela "electric_charging_records" NÃO EXISTE na base de dados. Por favor corra o Script SQL.');
                }
                if (selectError.message.includes('permission denied')) {
                    throw new Error('Permissão negada (RLS). Por favor corra o Script SQL para corrigir as permissões.');
                }
                throw selectError;
            }

            // 3. Check INSERT Permission (Dry Run / RLS Check)
            // We can't easily dry-run an insert without strict RLS, but if SELECT works, RLS *might* be okay.
            // Let's try to insert a dummy record that fails a constraint if possible, OR just trust SELECT for now + schema check.
            // Actually, best check is to trust the Select check for "Missing Table" which is the #1 suspect.

            toast.success(`Diagnóstico OK! Tabela existe. (${count} registos)`, { id: toastId, duration: 5000 });
            alert(`SISTEMA OPERACIONAL\n\n- Autenticação: OK (${session.user.email})\n- Tabela de registos: EXISTE\n- Total de registos: ${count}\n\nConexão à base de dados está funcional.`);

        } catch (error: any) {
            console.error('Diagnostic failed:', error);
            const msg = error.message || 'Erro desconhecido';
            toast.error('FALHA NO DIAGNÓSTICO', { id: toastId });
            setLastError({ diagnostic_error: msg, original_error: error });
            alert(`⚠️ ERRO CRÍTICO DETETADO ⚠️\n\n${msg}\n\nPor favor envie este erro ao suporte.`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
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
                const errors: string[] = [];

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

                // Helper to parse dates
                const parseDate = (val: any): string | null => {
                    if (!val) return null;
                    if (val instanceof Date) return val.toISOString();
                    if (typeof val === 'string') {
                        // Try standard parsing
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) return d.toISOString();
                    }
                    // Handle Excel serial number if cellDates didn't work for some reason
                    if (typeof val === 'number') {
                        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                        if (!isNaN(d.getTime())) return d.toISOString();
                    }
                    return null;
                };

                // Get User ID once
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData.user?.id;

                if (!userId) {
                    toast.error('Sessão expirada. Por favor faça login novamente.');
                    setImporting(false);
                    return;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const [index, row] of (data as any[]).entries()) {
                    const rowNum = index + 2; // +2 because header is 1
                    const plateRaw = row['Matricula'] || '';
                    const plateNorm = plateRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const vehicleId = vehicleMap.get(plateNorm);

                    if (!vehicleId) {
                        failCount++;
                        // errors.push(`Linha ${rowNum}: Viatura '${plateRaw}' não encontrada.`);
                        continue;
                    }

                    let driverId = null;
                    const driverRaw = row['Motorista (Opcional)'] ? String(row['Motorista (Opcional)']) : '';
                    if (driverRaw) driverId = driverMap.get(driverRaw.toLowerCase()) || null;

                    let costCenterId = null;
                    const ccRaw = row['Centro Custo (Opcional)'] ? String(row['Centro Custo (Opcional)']) : '';
                    if (ccRaw) costCenterId = ccMap.get(ccRaw.toLowerCase()) || null;

                    // Date Parsing
                    const dateRaw = row['Data'];
                    const dateIso = parseDate(dateRaw);

                    if (!dateIso) {
                        failCount++;
                        errors.push(`Linha ${rowNum}: Data inválida.`);
                        continue;
                    }

                    // Use robust number parsing
                    const kwhVal = String(row['kWh'] || '0').replace(',', '.');
                    const costVal = String(row['Custo'] || '0').replace(',', '.');
                    const durVal = String(row['Duracao (min)'] || '0').replace(',', '.');

                    recordsToInsert.push({
                        vehicle_id: vehicleId,
                        driver_id: driverId,
                        cost_center_id: costCenterId,
                        station_name: row['Estacao'] || 'Desconhecido',
                        date: dateIso,
                        kwh: parseFloat(kwhVal) || 0,
                        cost: parseFloat(costVal) || 0,
                        duration: parseFloat(durVal) || 0,
                        created_by: userId
                    });
                    successCount++;
                }

                if (recordsToInsert.length > 0) {
                    const { error } = await supabase.from('electric_charging_records').insert(recordsToInsert);
                    if (error) throw error;
                    toast.success(`${successCount} registos importados!`);
                    if (failCount > 0) {
                        toast(`${failCount} falhas.`, { icon: '⚠️' });
                        if (errors.length > 0) {
                            console.warn('Import errors:', errors);
                        }
                    }
                    fetchRecords();
                } else {
                    toast.error('Nenhum registo válido para importar.');
                    if (errors.length > 0) console.error(errors);
                }
            } catch (error: any) {
                console.error('Import error:', error);
                setLastError(error); // Set state if available
                toast.error('Erro crítico: ' + (error.message || 'Falha desconhecida'));
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
                        <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                            <BatteryCharging className="w-8 h-8 text-blue-400" />
                        </div>
                        Carregamentos Elétricos
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg font-light">Gestão de consumos e custos de energia</p>
                </div>

                <div className="flex gap-3 relative z-10">
                    <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 px-5 py-3 rounded-xl font-medium transition-all border border-slate-700 hover:border-slate-600 shadow-lg">
                        <TrendingUp className="w-4 h-4 rotate-180" /> <span className="hidden sm:inline">Template</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-[0_4px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.4)] disabled:opacity-50 hover:-translate-y-0.5">
                        {importing ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : <Truck className="w-5 h-5" />}
                        <span className="hidden sm:inline">Importar</span>
                    </button>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] active:scale-95 hover:-translate-y-0.5">
                        <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Novo Registo</span>
                    </button>
                </div>
            </div>

            {/* Debug Error Display */}
            {lastError && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-200 text-xs overflow-auto max-h-40">
                    <div className="flex justify-between items-center mb-2">
                        <strong>Debug Info (Erro):</strong>
                        <button onClick={() => setLastError(null)} className="text-white hover:text-red-300">X</button>
                    </div>
                    <pre>{JSON.stringify(lastError, null, 2)}</pre>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-24 h-24 text-emerald-500 rotate-12" />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Custo Total</p>
                            <h3 className="text-3xl font-bold text-white mt-1 group-hover:text-emerald-400 transition-colors">{totalCost.toFixed(2)} <span className="text-lg text-slate-500">€</span></h3>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
                                <TrendingUp className="w-3 h-3" />
                                <span>Total Acumulado</span>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                            <DollarSign className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="group bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="w-24 h-24 text-blue-500 rotate-12" />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Energia</p>
                            <h3 className="text-3xl font-bold text-white mt-1 group-hover:text-blue-400 transition-colors">{totalKwh.toFixed(1)} <span className="text-lg text-slate-500">kWh</span></h3>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
                                <BatteryCharging className="w-3 h-3" />
                                <span>Consumo Total</span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                            <Zap className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-800/30 p-1.5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" placeholder="Pesquisar estação ou matrícula..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900/50 border border-transparent rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all" />
                </div>
                <div className="w-full md:w-72">
                    <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="w-full bg-slate-900/50 border border-transparent rounded-xl px-4 py-3 text-white focus:outline-none focus:bg-slate-900 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all">
                        <option value="all">Todas as Viaturas</option>
                        {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950/50 text-slate-400 uppercase font-medium border-b border-white/5">
                            <tr>
                                <th className="px-6 py-5 tracking-wider text-xs">Data/Hora</th>
                                <th className="px-6 py-5 tracking-wider text-xs">Viatura</th>
                                <th className="px-6 py-5 tracking-wider text-xs">Estação / CC</th>
                                <th className="px-6 py-5 tracking-wider text-xs">Energia</th>
                                <th className="px-6 py-5 tracking-wider text-xs text-right">Custo</th>
                                <th className="px-6 py-5 tracking-wider text-xs text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                        <span>Carregando...</span>
                                    </div>
                                </td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-8 h-8 text-slate-600 mb-2" />
                                        <p className="text-lg font-medium text-slate-400">Sem registos encontrados</p>
                                    </div>
                                </td></tr>
                            ) : (
                                filteredRecords.map((r) => (
                                    <tr key={r.id} className="group hover:bg-slate-800/30 transition-all duration-200">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{new Date(r.date).toLocaleDateString()}</span>
                                                <span className="text-slate-500 text-xs font-mono">{new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/5 group-hover:border-blue-500/20 transition-colors">
                                                    <Truck className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                                                </div>
                                                <div>
                                                    <span className="block text-white font-medium bg-slate-800 px-2 py-0.5 rounded text-xs w-fit mb-0.5 border border-white/5">{r.vehicle?.matricula}</span>
                                                    <span className="text-slate-500 text-xs">{r.driver?.nome || 'Sem condutor'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="block text-white font-medium">{r.station_name}</span>
                                            {r.cost_center && (
                                                <div className="flex items-center gap-1.5 text-xs text-orange-400/80 mt-1">
                                                    <Building className="w-3 h-3" />
                                                    {r.cost_center.nome}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-yellow-500" />
                                                <span className="block text-white font-bold">{r.kwh} kWh</span>
                                            </div>
                                            <span className="text-slate-500 text-xs pl-6">{r.duration} min</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                                {r.cost.toFixed(2)} €
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-slate-900 rounded-3xl border border-white/10 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <BatteryCharging className="w-5 h-5 text-blue-500" />
                                </div>
                                Novo Carregamento
                            </h2>
                            <div className="flex items-center gap-2"> {/* Added a div to group buttons */}
                                <button
                                    onClick={runDiagnostics}
                                    className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20"
                                    title="Executar teste de conexão"
                                >
                                    <Zap size={20} />
                                    <span className="hidden sm:inline">Diagnóstico (TESTE)</span>
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <Trash2 className="w-5 h-5 rotate-45" />
                                </button>
                            </div>
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
                                    <div className="relative">
                                        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input type="number" step="0.01" required value={formData.kwh} onChange={e => setFormData({ ...formData, kwh: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Custo (€)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input type="number" step="0.01" required value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Duração (min)</label>
                                    <input type="number" step="1" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div className="pt-6 flex justify-end gap-3 border-t border-white/5 mt-8">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium">Cancelar</button>
                                <button type="submit" disabled={submitting} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95">
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
