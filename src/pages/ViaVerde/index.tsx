/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
    Ticket, Plus, Search,
    MapPin, DollarSign, Truck, User,
    Trash2, TrendingUp, Building,
    ParkingCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { TollRecord } from '../../types';
import toast from 'react-hot-toast';

import * as XLSX from 'xlsx';
import { parseNumber } from '../../utils/number';
import ImportPreviewModal, { type ImportRow } from '../../components/ImportPreviewModal';

import PageHeader from '../../components/common/PageHeader';

export default function ViaVerde() {
    const { viaturas, motoristas, centrosCustos } = useWorkshop();
    const [tolls, setTolls] = useState<TollRecord[]>([]);
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
        entry_point: '',
        entry_time: '',
        exit_time: '',
        exit_point: '',
        amount: '',
        distance: '',
        type: 'toll'
    });
    const [importing, setImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchTolls();
    }, []);

    const fetchTolls = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('via_verde_toll_records')
                .select(`
                    *,
                    vehicle:viaturas(id, matricula, marca, modelo),
                    driver:motoristas(id, nome),
                    cost_center:centros_custos(id, nome)
                `)
                .order('entry_time', { ascending: false });

            if (error) throw error;
            setTolls(data || []);
        } catch (error) {
            console.error('Error fetching tolls:', error);
            toast.error('Erro ao carregar portagens');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const { error } = await supabase.from('via_verde_toll_records').insert([{
                vehicle_id: formData.vehicle_id,
                driver_id: formData.driver_id || null,
                cost_center_id: formData.cost_center_id || null,
                entry_point: formData.entry_point,
                exit_point: formData.exit_point,
                entry_time: formData.entry_time,
                exit_time: formData.exit_time || null,
                amount: parseFloat(formData.amount) || 0,
                distance: formData.distance ? parseFloat(formData.distance) : null,
                type: formData.type || 'toll',
                created_by: (await supabase.auth.getUser()).data.user?.id
            }]);

            if (error) throw error;

            toast.success('Portagem registada com sucesso!');
            setShowModal(false);
            setFormData({
                vehicle_id: '',
                driver_id: '',
                cost_center_id: '',
                entry_point: '',
                exit_point: '',
                entry_time: '',
                exit_time: '',
                amount: '',
                distance: '',
                type: 'toll'
            });
            fetchTolls();
        } catch (error: any) {
            console.error('Error saving toll:', error);
            toast.error('Erro: ' + (error.message || 'Falha ao guardar'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem a certeza que deseja eliminar este registo?')) return;

        try {
            const { error } = await supabase
                .from('via_verde_toll_records')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Registo eliminado');
            fetchTolls();
        } catch (error) {
            console.error('Error deleting toll:', error);
            toast.error('Erro ao eliminar');
        }
    };

    // --- BULK DELETE LOGIC ---
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredTolls.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTolls.map(t => t.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Tem a certeza que deseja eliminar ${selectedIds.size} registos?`)) return;

        const toastId = toast.loading('A eliminar registos...');
        try {
            const { error } = await supabase
                .from('via_verde_toll_records')
                .delete()
                .in('id', Array.from(selectedIds));

            if (error) throw error;
            toast.success(`${selectedIds.size} registos eliminados!`, { id: toastId });
            setSelectedIds(new Set());
            fetchTolls();
        } catch (error) {
            console.error('Error bulk deleting:', error);
            toast.error('Erro ao eliminar registos', { id: toastId });
        }
    };

    // --- BULK IMPORT LOGIC ---

    const handleDownloadTemplate = () => {
        const headers = [
            'Matricula',
            'Data',         // YYYY-MM-DD
            'Hora Entrada', // HH:MM
            'Hora Saida',   // HH:MM
            'Portico Entrada',
            'Portico Saida',
            'Valor',
            'Distancia',
            'Motorista (Opcional)', // Name or NIF
            'Centro Custo (Opcional)',
            'Tipo (Portagem/Estacionamento)'
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'ViaVerde_Template.xlsx');
    };

    const runDiagnostics = async () => {
        const toastId = toast.loading('A executar diagnóstico...');
        try {
            // 1. Check Auth
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Utilizador não autenticado.');

            // 2. Check Table Existence & SELECT Permission
            const { count, error: selectError } = await supabase
                .from('via_verde_toll_records')
                .select('*', { count: 'exact', head: true });

            if (selectError) {
                // Determine specific error
                if (selectError.message.includes('relation') && selectError.message.includes('does not exist')) {
                    throw new Error('A tabela "via_verde_toll_records" NÃO EXISTE na base de dados. Por favor corra o Script SQL.');
                }
                if (selectError.message.includes('permission denied')) {
                    throw new Error('Permissão negada (RLS). Por favor corra o Script SQL para corrigir as permissões.');
                }
                throw selectError;
            }

            // 3. NEW: Check Type Column Existence
            const { error: colError } = await supabase
                .from('via_verde_toll_records')
                .select('type')
                .limit(1);

            if (colError) {
                if (colError.code === 'PGRST204' || colError.message.includes('Could not find the \'type\' column')) {
                    throw new Error('A coluna "type" (Tipo) NÃO EXISTE na tabela. O Script SQL precisa de ser corrido novamente para adicionar esta nova coluna.');
                }
                // Ignore other errors (e.g. empty table might return no data but no error)
            }

            toast.success(`Diagnóstico OK! Tabela existe. (${count} registos)`, { id: toastId, duration: 5000 });
            alert(`SISTEMA OPERACIONAL\n\n- Autenticação: OK (${session.user.email})\n- Tabela Via Verde: EXISTE\n- Total de registos: ${count}\n\nConexão funcional.`);

        } catch (error: any) {
            console.error('Diagnostic failed:', error);
            const msg = error.message || 'Erro desconhecido';
            toast.error('FALHA NO DIAGNÓSTICO', { id: toastId });
            setLastError({ diagnostic_error: msg, original_error: error });
            alert(`⚠️ ERRO CRÍTICO DETETADO ⚠️\n\n${msg}\n\nPor favor envie este erro ao suporte.`);
        }
    };

    // --- BULK IMPORT PREVIEW STATE ---
    const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

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

                // Pre-process maps
                const vehicleMap = new Map();
                viaturas.forEach(v => {
                    const normalized = v.matricula.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    vehicleMap.set(normalized, { id: v.id, ccId: (v as any).centro_custo_id || (v as any).centroCustoId });
                });

                const driverMap = new Map();
                motoristas.forEach(d => {
                    driverMap.set(d.nome.toLowerCase(), { id: d.id, nome: d.nome });
                    if ((d as any).nif) driverMap.set(String((d as any).nif), { id: d.id, nome: d.nome });
                });

                const ccMap = new Map();
                centrosCustos.forEach(c => {
                    ccMap.set(c.nome.toLowerCase(), { id: c.id, nome: c.nome });
                });

                // Helper for time extraction from string or Date
                const extractTimeStr = (val: any): string => {
                    if (!val) return '00:00';
                    if (val instanceof Date) {
                        return val.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                    // If decimal fraction of day (0.5 = 12:00)
                    if (typeof val === 'number') {
                        const totalSeconds = Math.floor(val * 86400);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    }
                    return String(val).trim();
                };

                // Get User ID once
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData.user?.id;
                if (!userId) throw new Error('Sessão expirada. Faça login novamente.');

                // Process Rows for Preview
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const processedRows: ImportRow[] = (data as any[]).map((row, index) => {
                    const errors: string[] = [];
                    const rowNum = index + 2;

                    // 1. Vehicle Check
                    const plateRaw = row['Matricula'] || '';
                    const plateNorm = String(plateRaw).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const vehicleData = vehicleMap.get(plateNorm);

                    if (!plateRaw) errors.push('Matrícula em falta');
                    else if (!vehicleData) errors.push(`Viatura não encontrada: ${plateRaw}`);

                    // 2. Date/Time Parsing
                    let entryTime = null;
                    let exitTime = null;
                    const dateRaw = row['Data'];
                    let dateStr = '';

                    const parseDate = (val: any): string | null => {
                        if (!val) return null;
                        if (val instanceof Date) return val.toISOString().split('T')[0];
                        if (typeof val === 'string') {
                            const d = new Date(val);
                            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                        }
                        if (typeof val === 'number') {
                            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                        }
                        return null;
                    };

                    dateStr = parseDate(dateRaw) || '';
                    if (!dateStr) errors.push(`Data inválida: ${dateRaw}`);

                    const timeIn = extractTimeStr(row['Hora Entrada']);
                    const timeOut = extractTimeStr(row['Hora Saida']);
                    if (dateStr) {
                        entryTime = `${dateStr}T${timeIn}:00`;
                        exitTime = `${dateStr}T${timeOut}:00`;
                    }

                    // 3. Values Parsing
                    const amountRaw = row['Valor'];
                    const distRaw = row['Distancia'];
                    const amount = parseNumber(amountRaw);
                    const distance = parseNumber(distRaw);

                    // 4. Cost Center Logic
                    let costCenterId = null;
                    let ccName = 'N/A';
                    const ccRaw = row['Centro Custo (Opcional)'];
                    if (ccRaw) {
                        const found = ccMap.get(String(ccRaw).toLowerCase());
                        if (found) {
                            costCenterId = found.id;
                            ccName = found.nome + ' (Manual)';
                        } else {
                            errors.push(`Centro Custo não encontrado: ${ccRaw}`);
                        }
                    } else if (vehicleData?.ccId) {
                        const cc = centrosCustos.find(c => c.id === vehicleData.ccId);
                        costCenterId = vehicleData.ccId;
                        ccName = (cc?.nome || 'Desconhecido') + ' (Auto)';
                    } else {
                        ccName = '---';
                    }

                    // 5. Driver Logic
                    let driverId = null;
                    const driverRaw = row['Motorista (Opcional)'];
                    if (driverRaw) {
                        const found = driverMap.get(String(driverRaw).toLowerCase());
                        if (found) {
                            driverId = found.id;
                        }
                    }

                    // Type Parsing
                    let type = 'toll';
                    const typeRaw = String(row['Tipo (Portagem/Estacionamento)'] || row['Tipo'] || '').toLowerCase();
                    if (typeRaw.includes('estacionamento') || typeRaw.includes('parque') || typeRaw.includes('parking')) {
                        type = 'parking';
                    }

                    const isValid = errors.length === 0;

                    return {
                        index: rowNum,
                        status: isValid ? 'valid' : 'error',
                        errors: isValid ? undefined : errors,
                        data: {
                            'Matrícula': plateRaw,
                            'Data': dateStr,
                            'Entrada': row['Portico Entrada'] || '-',
                            'CC Detetado': ccName,
                            'Valor (Raw)': amountRaw,
                            'Valor (Final)': amount,
                            'Distância (Final)': distance
                        },
                        payload: isValid ? {
                            vehicle_id: vehicleData?.id,
                            driver_id: driverId,
                            cost_center_id: costCenterId,
                            entry_point: row['Portico Entrada'] || 'Desconhecido',
                            exit_point: row['Portico Saida'] || 'Desconhecido',
                            entry_time: entryTime,
                            exit_time: exitTime,
                            amount: amount,
                            distance: distance,
                            type: type,
                            created_by: userId
                        } : undefined
                    };
                });

                setPreviewRows(processedRows);
                setShowPreviewModal(true);

            } catch (error: any) {
                console.error('Import error:', error);
                toast.error('Erro ao ler ficheiro: ' + error.message);
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const confirmImport = async () => {
        const validRows = previewRows.filter(r => r.status === 'valid' && r.payload);
        if (validRows.length === 0) return;

        setSubmitting(true);
        try {
            const records = validRows.map(r => r.payload);
            const { error } = await supabase.from('via_verde_toll_records').insert(records);

            if (error) throw error;

            toast.success(`${records.length} registos importados com sucesso!`);
            setShowPreviewModal(false);
            setPreviewRows([]);
            fetchTolls();
        } catch (error: any) {
            console.error('Bulk Insert Error:', error);
            toast.error('Erro ao gravar: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };


    // Filter Logic
    const filteredTolls = tolls.filter(t => {
        const matchesSearch =
            t.entry_point.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.exit_point.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.vehicle?.matricula || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesVehicle = filterVehicle === 'all' || t.vehicle_id === filterVehicle;

        return matchesSearch && matchesVehicle;
    });

    // Stats
    const totalCost = filteredTolls.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalDistance = filteredTolls.reduce((sum, t) => sum + (Number(t.distance) || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title="Via Verde & Portagens"
                subtitle="Gestão inteligente de passagens e custos de portagem"
                icon={Ticket}
                actions={
                    <div className="flex gap-3 relative z-10">
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-lg animate-in fade-in slide-in-from-right-4"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span className="hidden sm:inline">Eliminar ({selectedIds.size})</span>
                            </button>
                        )}
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 px-5 py-3 rounded-xl font-medium transition-all border border-slate-700 hover:border-slate-600 shadow-lg"
                        >
                            <TrendingUp className="w-4 h-4 rotate-180" />
                            <span className="hidden sm:inline">Template</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-[0_4px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.4)] disabled:opacity-50 hover:-translate-y-0.5"
                        >
                            {importing ? (
                                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
                            ) : (
                                <Truck className="w-5 h-5" />
                            )}
                            <span className="hidden sm:inline">Importar Excel</span>
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] active:scale-95 hover:-translate-y-0.5"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Novo Registo</span>
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Pesquisar por trajeto ou viatura..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all"
                        />
                    </div>
                    <select
                        value={filterVehicle}
                        onChange={(e) => setFilterVehicle(e.target.value)}
                        className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all"
                    >
                        <option value="all">Todas as Viaturas</option>
                        {viaturas.map(v => (
                            <option key={v.id} value={v.id}>{v.matricula} ({v.modelo})</option>
                        ))}
                    </select>
                </div>
            </PageHeader>

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

            <ImportPreviewModal
                isOpen={showPreviewModal}
                onClose={() => { setShowPreviewModal(false); setPreviewRows([]); }}
                onConfirm={confirmImport}
                rows={previewRows}
                title="Pré-visualização de Via Verde/Estacionamentos"
                isSubmitting={submitting}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                <div className="group bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 relative overflow-visible">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-24 h-24 text-emerald-500 rotate-12" />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Custo Total</p>
                            <h3 className="text-3xl font-bold text-white mt-1 group-hover:text-emerald-400 transition-colors">{totalCost.toFixed(2)} <span className="text-lg text-slate-500">€</span></h3>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
                                <TrendingUp className="w-3 h-3" />
                                <span>Vista Atual</span>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                            <DollarSign className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="group bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 relative overflow-visible">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MapPin className="w-24 h-24 text-blue-500 rotate-12" />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Distância Total</p>
                            <h3 className="text-3xl font-bold text-white mt-1 group-hover:text-blue-400 transition-colors">{totalDistance.toFixed(1)} <span className="text-lg text-slate-500">km</span></h3>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
                                <Truck className="w-3 h-3" />
                                <span>Km Percorridos</span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                            <MapPin className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="group bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 relative overflow-visible">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-24 h-24 text-purple-500 rotate-12" />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Passagens</p>
                            <h3 className="text-3xl font-bold text-white mt-1 group-hover:text-purple-400 transition-colors">{filteredTolls.length}</h3>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-400">
                                <Ticket className="w-3 h-3" />
                                <span>Registos</span>
                            </div>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors border border-purple-500/20">
                            <TrendingUp className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-800/30 p-1.5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Pesquisar entrada, saída ou matrícula..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-transparent rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    />
                </div>
                <div className="w-full md:w-72">
                    <select
                        value={filterVehicle}
                        onChange={(e) => setFilterVehicle(e.target.value)}
                        className="w-full bg-slate-900/50 border border-transparent rounded-xl px-4 py-3 text-white focus:outline-none focus:bg-slate-900 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-all"
                    >
                        <option value="all">Todas as Viaturas</option>
                        {viaturas.map(v => (
                            <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-x-auto backdrop-blur-sm shadow-xl">
                <table className="w-full text-left text-sm" style={{ minWidth: '700px' }}>
                    <thead className="bg-slate-950/50 text-slate-400 uppercase font-medium border-b border-white/5">
                        <tr>
                            <th className="px-6 py-5 w-10">
                                <input
                                    type="checkbox"
                                    checked={filteredTolls.length > 0 && selectedIds.size === filteredTolls.length}
                                    onChange={toggleAll}
                                    className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                                />
                            </th>
                            <th className="px-6 py-5 tracking-wider text-xs">Data/Hora</th>
                            <th className="px-6 py-5 tracking-wider text-xs">Viatura</th>
                            <th className="px-6 py-5 tracking-wider text-xs">Motorista / CC</th>
                            <th className="px-6 py-5 tracking-wider text-xs">Trajeto</th>
                            <th className="px-6 py-5 tracking-wider text-xs text-right">Valor</th>
                            <th className="px-6 py-5 tracking-wider text-xs text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                        <span>Carregando registos...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredTolls.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-8 h-8 text-slate-600 mb-2" />
                                        <p className="text-lg font-medium text-slate-400">Nenhum registo encontrado</p>
                                        <p className="text-sm">Tente ajustar os filtros ou adicionar um novo registo.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredTolls.map((toll) => (
                                <tr
                                    key={toll.id}
                                    className={`group transition-all duration-200 ${selectedIds.has(toll.id) ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-slate-800/30'}`}
                                    onClick={(e) => {
                                        // Toggle selection when clicking row (unless clicking button/link)
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                                        toggleSelection(toll.id);
                                    }}
                                >
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(toll.id)}
                                            onChange={() => toggleSelection(toll.id)}
                                            className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">
                                                {new Date(toll.entry_time).toLocaleDateString()}
                                            </span>
                                            <span className="text-slate-500 text-xs font-mono">
                                                {new Date(toll.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/5 group-hover:border-emerald-500/20 transition-colors">
                                                <Truck className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                                            </div>
                                            <div>
                                                <span className="block text-white font-medium bg-slate-800 px-2 py-0.5 rounded text-xs w-fit mb-0.5 border border-white/5">{toll.vehicle?.matricula}</span>
                                                <span className="text-slate-500 text-xs">{toll.vehicle?.marca} {toll.vehicle?.modelo}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            {toll.driver ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                                                        <User className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                    <span className="text-slate-300 text-sm">{toll.driver.nome}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 text-xs italic flex items-center gap-1">
                                                    <User className="w-3 h-3" /> Sem Condutor
                                                </span>
                                            )}
                                            {toll.cost_center && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Building className="w-3 h-3 text-orange-400/80" />
                                                    <span className="text-orange-400/80 font-medium">{toll.cost_center.nome}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            {toll.type === 'parking' ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 rounded bg-blue-500/10 text-blue-400">
                                                        <ParkingCircle className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-medium">{toll.entry_point}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                                                        <Ticket className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-medium bg-slate-800/50 px-2 py-1 rounded text-xs border border-white/5">{toll.entry_point || 'N/A'}</span>
                                                    <span className="text-slate-600">→</span>
                                                    <span className="font-medium bg-slate-800/50 px-2 py-1 rounded text-xs border border-white/5">{toll.exit_point || 'N/A'}</span>
                                                </>
                                            )}
                                        </div>
                                        {toll.distance && (
                                            <span className="text-xs text-slate-500 block mt-1.5 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {toll.distance} km
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                            {toll.amount.toFixed(2)} €
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(toll.id);
                                            }}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                                            title="Eliminar registo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <div className="bg-slate-900 rounded-3xl border border-white/10 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                        <Ticket className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    Novo Registo de Portagem
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={runDiagnostics}
                                        className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20"
                                        title="Executar teste de conexão"
                                    >
                                        <Ticket size={20} />
                                        <span className="hidden sm:inline">Diagnóstico (TESTE)</span>
                                    </button>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5 rotate-45" /> {/* Close icon */}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {/* Type Toggle */}
                                <div className="bg-slate-950/50 p-1 rounded-lg flex gap-1 border border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'toll' })}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${formData.type === 'toll' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <Ticket className="w-4 h-4" /> Portagem
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'parking' })}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${formData.type === 'parking' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <ParkingCircle className="w-4 h-4" /> Estacionamento
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Vehicle */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Viatura</label>
                                        <select
                                            required
                                            value={formData.vehicle_id}
                                            onChange={e => setFormData({ ...formData, vehicle_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                        >
                                            <option value="">Selecione Viatura...</option>
                                            {viaturas.map(v => (
                                                <option key={v.id} value={v.id}>{v.matricula} ({v.marca})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Driver */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Motorista (Opcional)</label>
                                        <select
                                            value={formData.driver_id}
                                            onChange={e => setFormData({ ...formData, driver_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                        >
                                            <option value="">Sem Motorista</option>
                                            {motoristas.map(m => (
                                                <option key={m.id} value={m.id}>{m.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Cost Center */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Centro de Custo (Opcional)</label>
                                        <select
                                            value={formData.cost_center_id}
                                            onChange={e => setFormData({ ...formData, cost_center_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                        >
                                            <option value="">Nenhum</option>
                                            {centrosCustos.map(c => (
                                                <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Entry Time */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Data/Hora Entrada</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.entry_time}
                                            onChange={e => setFormData({ ...formData, entry_time: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>

                                    {/* Cost */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Valor (€)</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Entry Point */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">
                                            {formData.type === 'toll' ? 'Pórtico Entrada' : 'Local / Parque'}
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="text"
                                                required
                                                value={formData.entry_point}
                                                onChange={e => setFormData({ ...formData, entry_point: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                                placeholder={formData.type === 'toll' ? "Ex: Lisboa" : "Ex: Parque do Aeroporto"}
                                            />
                                        </div>
                                    </div>

                                    {/* Exit Point */}
                                    {formData.type === 'toll' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-slate-400 uppercase">Pórtico Saída</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.exit_point}
                                                    onChange={e => setFormData({ ...formData, exit_point: e.target.value })}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                                    placeholder="Ex: Porto"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Distance */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Distância (KM)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.distance}
                                            onChange={e => setFormData({ ...formData, distance: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                            placeholder="Opcional"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95"
                                    >
                                        {submitting ? (
                                            <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                                        ) : (
                                            <Ticket className="w-4 h-4" />
                                        )}
                                        Registar Portagem
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
