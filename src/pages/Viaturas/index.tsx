import { useState } from 'react';
import {
    Search, Trash2, Car, Calendar, Info, LayoutTemplate,
    List, PlusCircle, Wrench, AlertTriangle, Fuel, CheckCircle, ArrowRight,
    Upload, Download, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Viatura } from '../../types';

import VehicleProfile from './VehicleProfile';

export default function Viaturas() {
    const { viaturas, addViatura, deleteViatura } = useWorkshop();
    const { t } = useTranslation();

    // Navigation
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'create'>('overview');

    const [selectedViatura, setSelectedViatura] = useState<Viatura | null>(null);
    const [filter, setFilter] = useState('');

    const [formData, setFormData] = useState<Omit<Viatura, 'id'>>({
        matricula: '',
        marca: '',
        modelo: '',
        ano: '',
        obs: ''
    });

    // Mock Status Logic
    const getVehicleStatus = (v: Viatura) => {
        const obsLower = (v.obs || '').toLowerCase();
        if (obsLower.includes('avaria') || obsLower.includes('oficina') || obsLower.includes('parada')) {
            return 'maintenance';
        }
        return 'active';
    };

    const stats = {
        total: viaturas.length,
        active: viaturas.filter(v => getVehicleStatus(v) === 'active').length,
        maintenance: viaturas.filter(v => getVehicleStatus(v) === 'maintenance').length,
        fuelAvg: '7.8 L/100km'
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addViatura({
            ...formData,
            id: crypto.randomUUID()
        });
        setActiveTab('list');
        setFormData({ matricula: '', marca: '', modelo: '', ano: '', obs: '' });
    };

    const handleDownloadTemplate = () => {
        const headers = ['Matricula', 'Marca', 'Modelo', 'Ano', 'PrecoDiario', 'Obs'];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Viaturas.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            let importedCount = 0;
            data.forEach((row: any) => {
                if (row.Matricula && row.Marca) {
                    addViatura({
                        id: crypto.randomUUID(),
                        matricula: String(row.Matricula).toUpperCase(),
                        marca: String(row.Marca),
                        modelo: String(row.Modelo || ''),
                        ano: String(row.Ano || new Date().getFullYear()),
                        obs: String(row.Obs || ''),
                        precoDiario: Number(row.PrecoDiario) || 0
                    });
                    importedCount++;
                }
            });

            if (importedCount > 0) {
                alert(`${importedCount} viaturas importadas com sucesso!`);
                setActiveTab('list');
            } else {
                alert('Nenhuma viatura válida encontrada no ficheiro.');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const filteredItems = viaturas.filter(v =>
        v.matricula.toLowerCase().includes(filter.toLowerCase()) ||
        v.marca.toLowerCase().includes(filter.toLowerCase()) ||
        v.modelo.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
            {/* Full Page Container */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-10">

                    {selectedViatura && (
                        <VehicleProfile
                            viatura={selectedViatura}
                            onClose={() => setSelectedViatura(null)}
                        />
                    )}

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-4">
                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                                    {t('vehicles.title')}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-bold border border-blue-500/20">
                                    {stats.total}
                                </span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium max-w-2xl">
                                {t('subtitle.vehicles')}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl font-medium transition-all shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden md:inline">Template</span>
                            </button>
                            <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl font-medium transition-all shadow-sm cursor-pointer">
                                <Upload className="w-4 h-4" />
                                <span className="hidden md:inline">Importar</span>
                                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <button
                                onClick={() => setActiveTab('create')}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                            >
                                <PlusCircle className="w-5 h-5" />
                                <span>Nova Viatura</span>
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-800">
                        {[
                            { id: 'overview', label: 'Dashboard Geral', icon: LayoutTemplate },
                            { id: 'list', label: 'Lista de Frota', icon: List },
                            { id: 'create', label: 'Registo', icon: PlusCircle },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all
                                ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* CONTENT AREA */}
                    <div className="min-h-[500px]">

                        {/* VIEW: OVERVIEW */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Car className="w-32 h-32 text-blue-500" />
                                        </div>
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20">
                                                <Car className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-400 font-medium text-sm uppercase tracking-wider">Total de Viaturas</h3>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className="text-4xl font-black text-white">{stats.total}</span>
                                                <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    {stats.active} Ativas
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Wrench className="w-32 h-32 text-amber-500" />
                                        </div>
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 border border-amber-500/20">
                                                <Wrench className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-400 font-medium text-sm uppercase tracking-wider">Em Manutenção</h3>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className="text-4xl font-black text-white">{stats.maintenance}</span>
                                                {stats.maintenance > 0 && (
                                                    <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                                        Requer Atenção
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Fuel className="w-32 h-32 text-purple-500" />
                                        </div>
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-4 border border-purple-500/20">
                                                <Fuel className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-400 font-medium text-sm uppercase tracking-wider">Consumo Médio</h3>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className="text-4xl font-black text-white">7.8</span>
                                                <span className="text-lg text-slate-500 font-medium">L/100km</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Alerts Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            Alertas de Manutenção
                                        </h3>
                                        {stats.maintenance > 0 ? (
                                            <div className="space-y-3">
                                                {viaturas.filter(v => getVehicleStatus(v) === 'maintenance').map(v => (
                                                    <div key={v.id} className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl hover:bg-amber-500/10 transition-colors cursor-pointer" onClick={() => setSelectedViatura(v)}>
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                                                <Car className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-white">{v.matricula}</p>
                                                                <p className="text-sm text-slate-400">{v.marca} {v.modelo}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-amber-500 text-sm font-medium">
                                                            <span>Ver Detalhes</span>
                                                            <ArrowRight className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                                <CheckCircle className="w-12 h-12 mb-3 text-emerald-500/50" />
                                                <p>Tudo operacional. Nenhuma viatura em manutenção.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/10 rounded-2xl p-6 flex flex-col justify-center">
                                        <h3 className="text-lg font-bold text-white mb-6">Ações Rápidas</h3>
                                        <div className="space-y-4">
                                            <button onClick={() => setActiveTab('create')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 rounded-xl transition-all group border border-slate-700 hover:border-blue-500">
                                                <span className="flex items-center gap-3 font-medium">
                                                    <PlusCircle className="w-5 h-5" />
                                                    Adicionar Nova Viatura
                                                </span>
                                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                            <button onClick={() => setActiveTab('list')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all group border border-slate-700">
                                                <span className="flex items-center gap-3 font-medium">
                                                    <List className="w-5 h-5" />
                                                    Ver Inventário Completo
                                                </span>
                                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* VIEW: LIST */}
                        {activeTab === 'list' && (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <div className="relative w-full md:w-96">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                                        <input
                                            type="text"
                                            placeholder="Pesquisar por matrícula, marca ou modelo..."
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200"
                                            value={filter}
                                            onChange={e => setFilter(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
                                            <Filter className="w-4 h-4" />
                                            Filtros
                                        </button>
                                        <div className="h-6 w-px bg-slate-700 mx-2"></div>
                                        <span className="text-sm text-slate-500 font-medium">
                                            Showing {filteredItems.length} results
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                    {filteredItems.map(viatura => {
                                        const status = getVehicleStatus(viatura);
                                        return (
                                            <div
                                                key={viatura.id}
                                                onClick={() => setSelectedViatura(viatura)}
                                                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 transition-all cursor-pointer group relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteViatura(viatura.id); }}
                                                        className="p-2 bg-slate-950 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold
                                                            ${status === 'maintenance' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-600/10 text-blue-500'}`}>
                                                            <Car className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-white text-lg tracking-wide">{viatura.matricula}</h3>
                                                            <p className="text-sm text-slate-400">{viatura.marca} {viatura.modelo}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-slate-800">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-500 flex items-center gap-2">
                                                            <Calendar className="w-4 h-4" /> {viatura.ano || 'N/A'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded textxs font-bold uppercase tracking-wider
                                                            ${status === 'maintenance' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                            {status === 'maintenance' ? 'Manutenção' : 'Operacional'}
                                                        </span>
                                                    </div>
                                                    {viatura.obs && (
                                                        <div className="p-2 bg-slate-950 rounded-lg text-xs text-slate-400 italic line-clamp-1 flex items-start gap-2">
                                                            <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-600" />
                                                            {viatura.obs}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* VIEW: CREATE */}
                        {activeTab === 'create' && (
                            <div className="max-w-4xl mx-auto w-full animate-in slide-in-from-bottom-8 duration-500">
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                    <div className="flex items-center gap-6 mb-8 relative z-10">
                                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                                            <PlusCircle className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Nova Viatura</h2>
                                            <p className="text-slate-400">Preencha os dados abaixo para adicionar um novo veículo à frota.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Matrícula</label>
                                                    <input
                                                        required
                                                        maxLength={8}
                                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white text-lg font-mono tracking-widest uppercase placeholder-slate-700 transition-all"
                                                        value={formData.matricula}
                                                        onChange={e => setFormData({ ...formData, matricula: e.target.value.toUpperCase() })}
                                                        placeholder="AA-00-BB"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Ano</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all"
                                                        value={formData.ano}
                                                        onChange={e => setFormData({ ...formData, ano: e.target.value })}
                                                        placeholder="Ex: 2023"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Marca</label>
                                                    <input
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all"
                                                        value={formData.marca}
                                                        onChange={e => setFormData({ ...formData, marca: e.target.value })}
                                                        placeholder="Ex: Mercedes-Benz"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Modelo</label>
                                                    <input
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all"
                                                        value={formData.modelo}
                                                        onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                                                        placeholder="Ex: Sprinter"
                                                    />
                                                </div>
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Observações</label>
                                                <textarea
                                                    rows={4}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white transition-all resize-none placeholder-slate-700"
                                                    value={formData.obs}
                                                    onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                                    placeholder="Informações adicionais, estado da viatura, etc..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('list')}
                                                className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                Registar Viatura
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
