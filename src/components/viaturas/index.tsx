import { useState } from 'react';
import {
    Search, Trash2, Car, Calendar, Info, LayoutTemplate,
    List, PlusCircle, Wrench, AlertTriangle, Fuel, CheckCircle, ArrowRight
} from 'lucide-react';
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

    // Mock Status Logic (Since Viatura type might not have status yet)
    // In a real app, this would be a field on the Viatura interface.
    const getVehicleStatus = (v: Viatura) => {
        // Mock logic: If obs contains "avaria" or "oficina", it's maintenance.
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
        // Mock fuel avg
        fuelAvg: '7.8 L/100km'
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addViatura({
            ...formData,
            id: crypto.randomUUID()
        });
        setActiveTab('list'); // Go to list after create
        setFormData({ matricula: '', marca: '', modelo: '', ano: '', obs: '' });
    };

    const filteredItems = viaturas.filter(v =>
        v.matricula.toLowerCase().includes(filter.toLowerCase()) ||
        v.marca.toLowerCase().includes(filter.toLowerCase()) ||
        v.modelo.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 font-sans h-full flex flex-col">
            {selectedViatura && (
                <VehicleProfile
                    viatura={selectedViatura}
                    onClose={() => setSelectedViatura(null)}
                />
            )}

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <Car className="w-6 h-6 text-blue-500" />
                    </div>
                    {t('vehicles.title')}
                </h1>
                <p className="text-slate-400">{t('subtitle.vehicles')}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                    ${activeTab === 'overview'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30'
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    Visão Geral
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                    ${activeTab === 'list'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30'
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <List className="w-4 h-4" />
                    Lista de Viaturas
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                    ${activeTab === 'create'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/30'
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <PlusCircle className="w-4 h-4" />
                    Nova Viatura
                </button>
            </div>

            {/* CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-slide-in-up">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Car className="w-24 h-24 text-blue-500" />
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Frota</h3>
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                            <div className="mt-4 flex items-center gap-2 text-blue-400 text-xs font-bold px-2 py-1 bg-blue-500/10 w-fit rounded-lg">
                                <CheckCircle className="w-3 h-3" />
                                {stats.active} Operacionais
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Wrench className="w-24 h-24 text-amber-500" />
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Em Manutenção</h3>
                            <p className="text-3xl font-bold text-white">{stats.maintenance}</p>
                            <div className="mt-4 flex items-center gap-2 text-amber-400 text-xs font-bold px-2 py-1 bg-amber-500/10 w-fit rounded-lg">
                                <AlertTriangle className="w-3 h-3" />
                                Requer atenção
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Fuel className="w-24 h-24 text-emerald-500" />
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Consumo Médio</h3>
                            <p className="text-3xl font-bold text-white">{stats.fuelAvg}</p>
                            <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-500/10 w-fit rounded-lg">
                                <CheckCircle className="w-3 h-3" />
                                Estimado (Global)
                            </div>
                        </div>
                    </div>

                    {/* Quick Access / Alerts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    Alertas de Frota
                                </h3>
                            </div>

                            {stats.maintenance > 0 ? (
                                <div className="space-y-3">
                                    {viaturas.filter(v => getVehicleStatus(v) === 'maintenance').map(v => (
                                        <div key={v.id} className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                                <Wrench className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-white font-bold">{v.matricula}</p>
                                                <p className="text-xs text-amber-400/80">{v.obs || 'Manutenção não especificada'}</p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedViatura(v)}
                                                className="ml-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-lg transition-colors"
                                            >
                                                Ver
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <p className="text-slate-300 font-medium">Tudo operacional</p>
                                    <p className="text-xs text-slate-500">Nenhuma viatura reportada com problemas.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/10 p-6 rounded-3xl relative overflow-hidden">
                            <h3 className="text-blue-200 text-lg font-bold mb-4">Gestão Rápida</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-between group transition-all shadow-lg shadow-blue-900/20"
                                >
                                    <span className="flex items-center gap-3 font-bold">
                                        <PlusCircle className="w-5 h-5 text-blue-200" />
                                        Registrar Nova Viatura
                                    </span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={() => setActiveTab('list')}
                                    className="w-full p-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl flex items-center justify-between group transition-all border border-slate-700/50"
                                >
                                    <span className="flex items-center gap-3 font-bold">
                                        <List className="w-5 h-5 text-slate-400" />
                                        Gerir Inventário Completo
                                    </span>
                                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: LIST */}
            {activeTab === 'list' && (
                <div className="space-y-6 animate-slide-in-from-right">
                    {/* Filters */}
                    <div className="flex justify-between items-center bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
                        <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                            <input
                                type="text"
                                placeholder={t('vehicles.search')}
                                className="w-full md:w-80 pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-200"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredItems.map(viatura => {
                            const status = getVehicleStatus(viatura);
                            return (
                                <div
                                    key={viatura.id}
                                    onClick={() => setSelectedViatura(viatura)}
                                    className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-900/10 transition-all group relative cursor-pointer"
                                >
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteViatura(viatura.id); }}
                                        className="absolute top-4 right-4 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-500/10 rounded-xl z-10"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`p-3 rounded-xl shadow-lg 
                                            ${status === 'maintenance'
                                                ? 'bg-amber-500/10 text-amber-500 shadow-amber-900/10'
                                                : 'bg-blue-600/10 text-blue-400 shadow-blue-900/10'}`}>
                                            <Car className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight tracking-wider font-mono">{viatura.matricula}</h3>
                                            <p className="text-sm text-slate-400 mt-0.5">{viatura.marca} {viatura.modelo}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mt-4 pt-4 border-t border-slate-700/50 text-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Calendar className="h-4 w-4 text-slate-500" />
                                                <span>{viatura.ano || 'N/A'}</span>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border
                                                ${status === 'maintenance'
                                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                }
                                            `}>
                                                {status === 'maintenance' ? 'Manutenção' : 'Operacional'}
                                            </div>
                                        </div>

                                        {viatura.obs && (
                                            <div className="flex items-start gap-2.5 text-slate-400 bg-slate-900/50 p-2 rounded-lg">
                                                <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                                                <span className="text-xs line-clamp-2 italic">{viatura.obs}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredItems.length === 0 && (
                            <div className="col-span-full text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-700">
                                <div className="inline-flex p-4 bg-slate-800/50 rounded-full mb-4">
                                    <Search className="w-8 h-8 text-slate-600" />
                                </div>
                                <p className="text-slate-500 text-lg">{t('vehicles.empty.title')}</p>
                                <p className="text-slate-600 text-sm mt-1">{t('vehicles.empty.subtitle')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONTENT: CREATE */}
            {activeTab === 'create' && (
                <div className="max-w-3xl mx-auto w-full animate-slide-in-up">
                    <div className="bg-slate-800/30 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl">
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-700/50">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                                <PlusCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{t('vehicles.new')}</h2>
                                <p className="text-slate-400 text-sm">Registrar uma nova viatura na frota.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('vehicles.form.plate')}</label>
                                    <input
                                        required
                                        maxLength={8}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 uppercase tracking-widest font-mono text-lg placeholder-slate-600 transition-all"
                                        value={formData.matricula}
                                        onChange={e => setFormData({ ...formData, matricula: e.target.value.toUpperCase() })}
                                        placeholder="AA-00-BB"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('vehicles.form.year')}</label>
                                    <input
                                        type="number"
                                        min="1900"
                                        max={new Date().getFullYear() + 1}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all"
                                        value={formData.ano}
                                        onChange={e => setFormData({ ...formData, ano: e.target.value })}
                                        placeholder={new Date().getFullYear().toString()}
                                    />
                                </div>
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('vehicles.form.brand')}</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all"
                                            value={formData.marca}
                                            onChange={e => setFormData({ ...formData, marca: e.target.value })}
                                            placeholder="Ex: Mercedes-Benz"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('vehicles.form.model')}</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all"
                                            value={formData.modelo}
                                            onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                                            placeholder="Ex: Sprinter 316 CDI"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('vehicles.form.obs')}</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all resize-none placeholder-slate-600"
                                        value={formData.obs}
                                        onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                        placeholder="Ex: Viatura com porta lateral danificada..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-700/50">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('list')}
                                    className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Salvar Viatura
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
