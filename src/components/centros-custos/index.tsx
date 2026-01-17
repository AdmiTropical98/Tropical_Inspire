// Force Deployment
import React, { useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { Plus, Trash2, Building2, MapPin } from 'lucide-react';
import type { CentroCusto } from '../../types';

export default function CentrosCustos() {
    const { centrosCustos, addCentroCusto, deleteCentroCusto, fuelTransactions, requisicoes, motoristas, manualHours } = useWorkshop();
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [nome, setNome] = useState('');
    const [localizacao, setLocalizacao] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome) return;

        const newCC: CentroCusto = {
            id: crypto.randomUUID(),
            nome,
            localizacao
        };

        addCentroCusto(newCC);
        setShowForm(false);
        setNome('');
        setLocalizacao('');
    };

    // --- Global Totals Calculations ---
    const globalFuelTotal = fuelTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const globalReqTotal = requisicoes.reduce((sum, r) => sum + (r.custo || 0), 0);

    // Global Labor (Approximation based on current drivers)
    let globalLaborTotal = 0;
    const now = new Date();
    motoristas.forEach(m => {
        const regDate = m.dataRegisto ? new Date(m.dataRegisto) : new Date();
        const months = (now.getFullYear() - regDate.getFullYear()) * 12 + (now.getMonth() - regDate.getMonth()) + 1;
        const activeMonths = Math.max(1, months);
        if (m.vencimentoBase) globalLaborTotal += m.vencimentoBase * activeMonths;
    });

    manualHours.forEach(mh => {
        const driver = motoristas.find(d => d.id === mh.motoristaId);
        if (driver && driver.valorHora) {
            const start = new Date(`1970-01-01T${mh.startTime}`);
            const end = new Date(`1970-01-01T${mh.endTime}`);
            let diffHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (diffHrs < 0) diffHrs += 24;
            const duration = diffHrs - ((mh.breakDuration || 0) / 60);
            if (duration > 0) globalLaborTotal += duration * driver.valorHora;
        }
    });

    const grandTotal = globalFuelTotal + globalReqTotal + globalLaborTotal;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-10 bg-[#020617]">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-white via-blue-200 to-slate-500 bg-clip-text text-transparent tracking-tight">
                        Centros de Custos
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Análise detalhada de rentabilidade e alocação de recursos por unidade.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Centro
                    </button>
                </div>
            </div>

            {/* Global Insight Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Despesa Global</p>
                    <p className="text-3xl font-black text-white">{grandTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
                    <div className="mt-3 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-full" />
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Combustível (Total)</p>
                    <p className="text-2xl font-bold text-blue-400">{globalFuelTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{((globalFuelTotal / (grandTotal || 1)) * 100).toFixed(1)}% do orçamento</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Mão de Obra (Total)</p>
                    <p className="text-2xl font-bold text-emerald-400">{globalLaborTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{((globalLaborTotal / (grandTotal || 1)) * 100).toFixed(1)}% do orçamento</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Unidades Ativas</p>
                    <p className="text-2xl font-bold text-white">{centrosCustos.length}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Locais de operação</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {centrosCustos.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-20 bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-800">
                        <Building2 className="w-16 h-16 text-slate-700 mb-6" />
                        <h3 className="text-xl font-bold text-slate-400">Sem Unidades Registadas</h3>
                        <p className="text-slate-500 text-sm mt-1">Comece por adicionar o seu primeiro centro de custo.</p>
                    </div>
                ) : (
                    centrosCustos.map(cc => {
                        const ccFuelTrans = fuelTransactions.filter(t => t.centroCustoId === cc.id);
                        const fuelExpenses = ccFuelTrans.reduce((sum, t) => sum + (t.totalCost || 0), 0);
                        const fuelLiters = ccFuelTrans.reduce((sum, t) => sum + (t.liters || 0), 0);

                        const ccReqs = requisicoes.filter(r => r.centroCustoId === cc.id);
                        const reqExpenses = ccReqs.reduce((sum, r) => sum + (r.custo || 0), 0);

                        const ccDrivers = motoristas.filter(m => m.centroCustoId === cc.id);
                        let laborExpenses = 0;
                        ccDrivers.forEach(m => {
                            const regDate = m.dataRegisto ? new Date(m.dataRegisto) : new Date();
                            const months = (now.getFullYear() - regDate.getFullYear()) * 12 + (now.getMonth() - regDate.getMonth()) + 1;
                            const activeMonths = Math.max(1, months);
                            if (m.vencimentoBase) laborExpenses += m.vencimentoBase * activeMonths;
                        });

                        const ccManualHours = manualHours.filter(mh => {
                            const driver = motoristas.find(d => d.id === mh.motoristaId);
                            return driver && driver.centroCustoId === cc.id;
                        });
                        ccManualHours.forEach(mh => {
                            const driver = motoristas.find(d => d.id === mh.motoristaId);
                            if (driver && driver.valorHora) {
                                const start = new Date(`1970-01-01T${mh.startTime}`);
                                const end = new Date(`1970-01-01T${mh.endTime}`);
                                let diffHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                if (diffHrs < 0) diffHrs += 24;
                                const duration = diffHrs - ((mh.breakDuration || 0) / 60);
                                if (duration > 0) laborExpenses += duration * driver.valorHora;
                            }
                        });

                        const totalCC = fuelExpenses + reqExpenses + laborExpenses;
                        const fuelPct = totalCC > 0 ? (fuelExpenses / totalCC) * 100 : 0;
                        const laborPct = totalCC > 0 ? (laborExpenses / totalCC) * 100 : 0;
                        const reqPct = totalCC > 0 ? (reqExpenses / totalCC) * 100 : 0;

                        return (
                            <div key={cc.id} className="group relative bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all duration-500 shadow-2xl hover:shadow-blue-500/5">
                                {/* Visual Decoration */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all" />

                                <div className="p-8">
                                    <div className="flex items-start justify-between mb-8">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600 group-hover:border-blue-500 transition-all duration-500">
                                                <Building2 className="w-7 h-7 text-blue-400 group-hover:text-white transition-colors" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{cc.nome}</h3>
                                                <div className="flex items-center gap-2 text-slate-500 mt-1.5 text-xs font-bold">
                                                    <MapPin className="w-3.5 h-3.5 text-blue-500/50" />
                                                    <span>{cc.localizacao || 'Sem morada'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteCentroCusto(cc.id)}
                                            className="p-2.5 bg-slate-900/50 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 border border-slate-800"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Financial Summary */}
                                    <div className="mb-8">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Custo Acumulado</p>
                                            <p className="text-[10px] text-emerald-500 font-black uppercase">Rentável</p>
                                        </div>
                                        <p className="text-4xl font-black text-white tracking-tighter">
                                            {totalCC.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                        </p>
                                    </div>

                                    {/* Key Metrics Row */}
                                    <div className="grid grid-cols-3 gap-3 mb-8">
                                        <div className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-2xl text-center">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Motoristas</p>
                                            <p className="text-sm font-bold text-white">{ccDrivers.length}</p>
                                        </div>
                                        <div className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-2xl text-center">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Litros</p>
                                            <p className="text-sm font-bold text-white">{fuelLiters.toFixed(0)}L</p>
                                        </div>
                                        <div className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-2xl text-center">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Pedidos</p>
                                            <p className="text-sm font-bold text-white">{ccReqs.length}</p>
                                        </div>
                                    </div>

                                    {/* Breakdown Visualization */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                            <span className="text-slate-500">Repartição de Custos</span>
                                            <span className="text-white">100%</span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
                                            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${fuelPct}%` }} title={`Combustível: ${fuelPct.toFixed(1)}%`} />
                                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${laborPct}%` }} title={`Mão de Obra: ${laborPct.toFixed(1)}%`} />
                                            <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${reqPct}%` }} title={`Requisições: ${reqPct.toFixed(1)}%`} />
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                <span>Fuel {fuelExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span>Work {laborExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                <span>Buy {reqExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Footnote */}
                                    <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
                                        <button className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">Ver Relatório</button>
                                        <div className="flex gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
                    <div className="bg-[#0f172a] w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-800">
                            <h2 className="text-2xl font-black text-white px-2">Nova Unidade</h2>
                            <p className="text-slate-500 text-sm mt-1 px-2">Registe um novo centro de custo estratégico.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nome / Escritório</label>
                                <input
                                    type="text"
                                    required
                                    value={nome}
                                    onChange={e => setNome(e.target.value)}
                                    className="w-full bg-[#020617] border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                                    placeholder="Ex: Escritório Lisboa"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Localização (Opcional)</label>
                                <div className="relative">
                                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                    <input
                                        type="text"
                                        value={localizacao}
                                        onChange={e => setLocalizacao(e.target.value)}
                                        className="w-full bg-[#020617] border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                                        placeholder="Ex: Av. da Liberdade"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-6 py-4 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
