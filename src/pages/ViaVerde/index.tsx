import React, { useState, useEffect } from 'react';
import {
    Zap, Plus, Search,
    MapPin, DollarSign, Truck, User,
    Trash2, TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { TollRecord } from '../../types';
import toast from 'react-hot-toast';

export default function ViaVerde() {
    const { viaturas, motoristas } = useWorkshop();
    const [tolls, setTolls] = useState<TollRecord[]>([]);
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
        entry_point: '',
        exit_point: '',
        entry_time: '',
        exit_time: '',
        amount: '',
        distance: ''
    });

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
                    driver:motoristas(id, nome)
                `)
                .order('entry_time', { ascending: false });

            if (error) throw error;
            setTolls(data || []);
        } catch (error) {
            console.error('Error fetching tolls:', error);
            // toast.error('Erro ao carregar portagens'); 
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
                driver_id: formData.driver_id || null, // Optional
                entry_point: formData.entry_point,
                exit_point: formData.exit_point,
                entry_time: formData.entry_time,
                exit_time: formData.exit_time || null,
                amount: parseFloat(formData.amount),
                distance: formData.distance ? parseFloat(formData.distance) : null
            }]);

            if (error) throw error;

            toast.success('Portagem registada com sucesso!');
            setShowModal(false);
            setFormData({
                vehicle_id: '',
                driver_id: '',
                entry_point: '',
                exit_point: '',
                entry_time: '',
                exit_time: '',
                amount: '',
                distance: ''
            });
            fetchTolls();
        } catch (error) {
            console.error('Error saving toll:', error);
            toast.error('Erro ao guardar registo');
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
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Zap className="w-6 h-6 text-emerald-500" />
                        </div>
                        Via Verde & Portagens
                    </h1>
                    <p className="text-slate-400 mt-1">Gestão de passagens e custos de portagem</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Novo Registo
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Custo Total (Vista Atual)</p>
                            <h3 className="text-2xl font-bold text-white mt-2">{totalCost.toFixed(2)} €</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Distância Total (Vista Atual)</p>
                            <h3 className="text-2xl font-bold text-white mt-2">{totalDistance.toFixed(1)} km</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <MapPin className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Passagens Registadas</p>
                            <h3 className="text-2xl font-bold text-white mt-2">{filteredTolls.length}</h3>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar entrada, saída ou matrícula..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={filterVehicle}
                        onChange={(e) => setFilterVehicle(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer"
                    >
                        <option value="all">Todas as Viaturas</option>
                        {viaturas.map(v => (
                            <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
                        ))}
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
                                <th className="px-6 py-4">Motorista/Responsável</th>
                                <th className="px-6 py-4">Trajeto</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        Carregando registos...
                                    </td>
                                </tr>
                            ) : filteredTolls.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum registo encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredTolls.map((toll) => (
                                    <tr key={toll.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">
                                                    {new Date(toll.entry_time).toLocaleDateString()}
                                                </span>
                                                <span className="text-slate-400 text-xs">
                                                    {new Date(toll.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                                    <Truck className="w-4 h-4 text-slate-300" />
                                                </div>
                                                <div>
                                                    <span className="block text-white font-medium">{toll.vehicle?.matricula}</span>
                                                    <span className="text-slate-400 text-xs">{toll.vehicle?.marca} {toll.vehicle?.modelo}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {toll.driver ? (
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-300">{toll.driver.nome}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 italic">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <span className="font-medium">{toll.entry_point}</span>
                                                <span className="text-slate-500">→</span>
                                                <span className="font-medium">{toll.exit_point}</span>
                                            </div>
                                            {toll.distance && (
                                                <span className="text-xs text-slate-500 block mt-1">{toll.distance} km</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-400">
                                            {toll.amount.toFixed(2)} €
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleDelete(toll.id)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-500" /> Novo Registo de Portagem
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <Trash2 className="w-5 h-5 rotate-45" /> {/* Close icon using trash rotate or X */}
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                                    <label className="text-xs font-medium text-slate-400 uppercase">Pórtico Entrada</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.entry_point}
                                        onChange={e => setFormData({ ...formData, entry_point: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                        placeholder="Ex: Lisboa"
                                    />
                                </div>

                                {/* Exit Point */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Pórtico Saída</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.exit_point}
                                        onChange={e => setFormData({ ...formData, exit_point: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500"
                                        placeholder="Ex: Porto"
                                    />
                                </div>

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
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? 'A guardar...' : 'Guardar Registo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
