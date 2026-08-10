import React, { useState } from 'react';
import { useWorkshop } from '../../../contexts/WorkshopContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Check, X, History, Fuel } from 'lucide-react';

export default function CombustivelTablet() {
    const { viaturas, motoristas, centrosCustos, fuelTransactions, registerRefuel } = useWorkshop();
    const { currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form, setForm] = useState({
        driverId: '',
        vehicleId: '',
        liters: '',
        km: '',
        centroCustoId: '',
        fuelType: 'gasoleo'
    });

    const recentTransactions = fuelTransactions
        .filter(tx => tx.status === 'confirmed')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!form.vehicleId || !form.liters) {
            alert('Viatura e Litros são obrigatórios.');
            return;
        }

        try {
            await registerRefuel({
                id: crypto.randomUUID(),
                driverId: form.driverId || 'manual',
                vehicleId: form.vehicleId,
                liters: Number(form.liters),
                km: Number(form.km),
                centroCustoId: form.centroCustoId || undefined,
                fuelType: form.fuelType,
                status: 'confirmed',
                timestamp: new Date().toISOString(),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Admin'
            });
            
            setForm({ driverId: '', vehicleId: '', liters: '', km: '', centroCustoId: '', fuelType: 'gasoleo' });
            setIsModalOpen(false);
        } catch (error: any) {
            alert('Erro ao registar: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Combustíveis</h1>
                    <p className="text-slate-500 text-lg">Gestão de abastecimentos da frota</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95"
                >
                    <Plus className="w-8 h-8" />
                    Registar Abastecimento
                </button>
            </div>

            <div className="bg-white flex-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                    <History className="w-6 h-6 text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-800">Últimos Abastecimentos</h2>
                </div>
                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-left text-lg">
                        <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold uppercase text-sm tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Data</th>
                                <th className="p-4">Viatura</th>
                                <th className="p-4">Motorista</th>
                                <th className="p-4">Litros</th>
                                <th className="p-4">Km</th>
                                <th className="p-4">Staff</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 pl-6 text-slate-700">
                                        {new Date(tx.timestamp).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-4 font-bold text-slate-900">
                                        {viaturas.find(v => v.id === tx.vehicleId)?.matricula || tx.vehicleId}
                                    </td>
                                    <td className="p-4 text-slate-700">
                                        {motoristas.find(m => m.id === tx.driverId)?.nome || '-'}
                                    </td>
                                    <td className="p-4 font-bold text-blue-600">
                                        {tx.liters.toFixed(2)} L
                                    </td>
                                    <td className="p-4 text-slate-700">
                                        {tx.km || '-'}
                                    </td>
                                    <td className="p-4 text-slate-500 text-base">
                                        {tx.staffName}
                                    </td>
                                </tr>
                            ))}
                            {recentTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        Nenhum abastecimento recente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for New Refuel */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full">
                        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                                    <Fuel className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900">Novo Abastecimento</h2>
                                    <p className="text-slate-500">Registe o abastecimento na viatura</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        
                        <div className="p-6 sm:p-8 overflow-y-auto">
                            <form id="refuel-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="block text-lg font-bold text-slate-700">Viatura *</label>
                                    <select 
                                        required 
                                        value={form.vehicleId} 
                                        onChange={e => setForm({...form, vehicleId: e.target.value})}
                                        className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-slate-50"
                                    >
                                        <option value="">Selecione a viatura...</option>
                                        {viaturas.filter(v => v.estado === 'ativo').map(v => (
                                            <option key={v.id} value={v.id}>{v.matricula} {v.marca ? `- ${v.marca}` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-lg font-bold text-slate-700">Motorista</label>
                                    <select 
                                        value={form.driverId} 
                                        onChange={e => setForm({...form, driverId: e.target.value})}
                                        className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-slate-50"
                                    >
                                        <option value="">Selecione o motorista...</option>
                                        {motoristas.filter(m => m.ativo).map(m => (
                                            <option key={m.id} value={m.id}>{m.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-lg font-bold text-slate-700">Litros *</label>
                                    <input 
                                        type="number" 
                                        required 
                                        step="0.01" 
                                        min="0"
                                        value={form.liters} 
                                        onChange={e => setForm({...form, liters: e.target.value})}
                                        className="w-full p-4 text-2xl font-bold border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-slate-50 text-blue-700"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-lg font-bold text-slate-700">Quilómetros Atuais</label>
                                    <input 
                                        type="number" 
                                        step="1" 
                                        min="0"
                                        value={form.km} 
                                        onChange={e => setForm({...form, km: e.target.value})}
                                        className="w-full p-4 text-xl border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-slate-50"
                                        placeholder="Ex: 150000"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-lg font-bold text-slate-700">Centro de Custo</label>
                                    <select 
                                        value={form.centroCustoId} 
                                        onChange={e => setForm({...form, centroCustoId: e.target.value})}
                                        className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-slate-50"
                                    >
                                        <option value="">Nenhum...</option>
                                        {centrosCustos.map(c => (
                                            <option key={c.id} value={c.id}>{c.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-6 sm:p-8 border-t border-slate-100 bg-slate-50 flex gap-4 justify-end">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors text-lg"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="refuel-form"
                                className="flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-lg active:scale-95"
                            >
                                <Check className="w-6 h-6" />
                                Confirmar Abastecimento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
