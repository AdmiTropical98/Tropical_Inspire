// Force Deployment
import React, { useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useFinancial } from '../../contexts/FinancialContext';
import { Plus, Trash2, Building2, MapPin, X, Download, Users, Car, Fuel, Wallet, ChevronRight, Zap, Wrench } from 'lucide-react';
import type { CentroCusto } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';

export default function CentrosCustos() {
    const { centrosCustos, addCentroCusto, deleteCentroCusto, fuelTransactions, requisicoes, motoristas, manualHours, viaturas } = useWorkshop();
    const { tolls, charging } = useFinancial(); // Get Via Verde & Charging Data
    const [showForm, setShowForm] = useState(false);
    const [selectedCC, setSelectedCC] = useState<CentroCusto | null>(null);
    const [cardViews, setCardViews] = useState<Record<string, 'financial' | 'operational'>>({});

    // Form State
    const [nome, setNome] = useState('');
    const [localizacao, setLocalizacao] = useState('');
    const [isRepairing, setIsRepairing] = useState(false);

    const handleRepairData = async () => {
        if (!confirm('Deseja processar e corrigir automaticamente os registos (Carregamentos e Via Verde) que não têm Centro de Custo associado, baseando-se na viatura atual?')) return;

        setIsRepairing(true);
        try {
            // 1. Get Map of Vehicle -> Cost Center
            const vehicleCCMap = new Map<string, string>();
            viaturas.forEach(v => {
                if (v.centro_custo_id) {
                    vehicleCCMap.set(v.id, v.centro_custo_id);
                }
            });

            // 2. Fix Charging Records
            const { data: chargingData } = await supabase.from('electric_charging_records').select('id, vehicle_id').is('cost_center_id', null);
            let fixedCharging = 0;
            if (chargingData) {
                for (const rec of chargingData) {
                    const ccId = vehicleCCMap.get(rec.vehicle_id);
                    if (ccId) {
                        await supabase.from('electric_charging_records').update({ cost_center_id: ccId }).eq('id', rec.id);
                        fixedCharging++;
                    }
                }
            }

            // 3. Fix Via Verde Records
            const { data: tollData } = await supabase.from('via_verde_toll_records').select('id, vehicle_id').is('cost_center_id', null);
            let fixedTolls = 0;
            if (tollData) {
                for (const rec of tollData) {
                    const ccId = vehicleCCMap.get(rec.vehicle_id);
                    if (ccId) {
                        await supabase.from('via_verde_toll_records').update({ cost_center_id: ccId }).eq('id', rec.id);
                        fixedTolls++;
                    }
                }
            }

            alert(`Processo concluído!\n\nCarregamentos corrigidos: ${fixedCharging}\nRegistos Via Verde corrigidos: ${fixedTolls}\n\nA página será recarregada.`);
            window.location.reload();

        } catch (error) {
            console.error('Error repairing data:', error);
            alert('Erro ao processar dados.');
        } finally {
            setIsRepairing(false);
        }
    };


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

    const toggleCardView = (ccId: string, view: 'financial' | 'operational') => {
        setCardViews(prev => ({ ...prev, [ccId]: view }));
    };

    const exportCCReport = (cc: CentroCusto) => {
        const doc = new jsPDF();
        const now = new Date();

        // Header
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('Relatório de Centro de Custo', 15, 25);

        doc.setTextColor(200, 200, 200);
        doc.setFontSize(10);
        doc.text(`Unidade: ${cc.nome.toUpperCase()}`, 15, 33);
        doc.text(`Data: ${now.toLocaleDateString('pt-PT')} ${now.toLocaleTimeString('pt-PT')}`, 140, 33);

        const ccFuel = fuelTransactions.filter(t => t.centroCustoId === cc.id);
        const ccReqs = requisicoes.filter(r => r.centroCustoId === cc.id);
        const ccDrivers = motoristas.filter(m => m.centroCustoId === cc.id);
        const ccTolls = (tolls || []).filter(t => t.cost_center_id === cc.id); // Via Verde
        const ccCharging = (charging || []).filter(c => c.cost_center_id === cc.id); // Charging

        let yPos = 50;

        // Fuel Section
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.text('1. Combustível', 15, yPos);

        const fuelRows = ccFuel.map(t => [
            new Date(t.timestamp).toLocaleDateString('pt-PT'),
            viaturas.find(v => v.id === t.vehicleId)?.matricula || '---',
            `${(t.liters || 0).toFixed(2)} L`,
            `${(t.totalCost || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`
        ]);

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Data', 'Viatura', 'Litros', 'Custo']],
            body: fuelRows,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] } // Blue
        });

        // Charging Section
        yPos = (doc as any).lastAutoTable.finalY + 15;
        doc.text('2. Carregamentos Elétricos', 15, yPos);

        const chargingRows = ccCharging.map(c => [
            new Date(c.date).toLocaleDateString('pt-PT'),
            viaturas.find(v => v.id === c.vehicle_id)?.matricula || '---',
            `${(c.kwh || 0).toFixed(2)} kWh`,
            `${(c.cost || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`
        ]);

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Data', 'Viatura', 'kWh', 'Custo']],
            body: chargingRows,
            theme: 'striped',
            headStyles: { fillColor: [34, 211, 238] } // Cyan
        });

        // Requisitions Section
        yPos = (doc as any).lastAutoTable.finalY + 15;
        doc.text('3. Requisições e Peças', 15, yPos);

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Data', 'Descrição', 'Valor']],
            body: ccReqs.map(r => [
                new Date(r.data).toLocaleDateString('pt-PT'),
                r.itens?.map(i => i.descricao).join(', ') || '---',
                `${(r.custo || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [245, 158, 11] } // Amber
        });

        // Via Verde Section
        yPos = (doc as any).lastAutoTable.finalY + 15;
        doc.text('4. Via Verde (Portagens/Estacionamento)', 15, yPos);

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Data', 'Entrada -> Saída', 'Valor']],
            body: ccTolls.map(t => [
                new Date(t.entry_time).toLocaleDateString('pt-PT'),
                t.type === 'parking' ? t.entry_point : `${t.entry_point} -> ${t.exit_point}`,
                `${(t.amount || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] } // Emerald
        });

        // Team Section
        yPos = (doc as any).lastAutoTable.finalY + 15;
        doc.text('5. Mão de Obra e Equipa', 15, yPos);

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Motorista', 'Status', 'Salário Base']],
            body: ccDrivers.map(m => [
                m.nome || '---',
                m.status || '---',
                `${(m.vencimentoBase || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241] } // Indigo
        });

        doc.save(`Relatorio_${cc.nome.replace(/\s+/g, '_')}.pdf`);
    };

    // --- Global Totals Calculations ---
    const globalFuelTotal = fuelTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0) +
        (charging || []).reduce((sum, c) => sum + (c.cost || 0), 0);

    const globalReqTotal = requisicoes.reduce((sum, r) => sum + (r.custo || 0), 0) +
        (tolls || []).reduce((sum, t) => sum + (t.amount || 0), 0);

    // Global Labor
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
                    <button
                        onClick={handleRepairData}
                        disabled={isRepairing}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 shadow-lg disabled:opacity-50"
                        title="Corrigir/Atualizar Centros de Custo nos Registos"
                    >
                        <Wrench className={`w-5 h-5 ${isRepairing ? 'animate-spin' : ''}`} />
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
                    <p className="text-2xl font-bold text-indigo-400">{globalLaborTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
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
                        const currentView = cardViews[cc.id] || 'financial';
                        const ccFuelTrans = fuelTransactions.filter(t => t.centroCustoId === cc.id);
                        const ccChargingRecs = (charging || []).filter(c => c.cost_center_id === cc.id);

                        const fuelExpenses = ccFuelTrans.reduce((sum, t) => sum + (t.totalCost || 0), 0);
                        const chargingExpenses = ccChargingRecs.reduce((sum, c) => sum + (c.cost || 0), 0);

                        const fuelLiters = ccFuelTrans.reduce((sum, t) => sum + (t.liters || 0), 0);

                        const ccReqs = requisicoes.filter(r => r.centroCustoId === cc.id);
                        const ccTolls = (tolls || []).filter(t => t.cost_center_id === cc.id);

                        const reqExpenses = ccReqs.reduce((sum, r) => sum + (r.custo || 0), 0);
                        const tollExpenses = ccTolls.reduce((sum, t) => sum + (t.amount || 0), 0);

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

                        const totalCC = fuelExpenses + chargingExpenses + reqExpenses + tollExpenses + laborExpenses;

                        const fuelPct = totalCC > 0 ? (fuelExpenses / totalCC) * 100 : 0;
                        const chargingPct = totalCC > 0 ? (chargingExpenses / totalCC) * 100 : 0;
                        const tollPct = totalCC > 0 ? (tollExpenses / totalCC) * 100 : 0;
                        const reqPct = totalCC > 0 ? (reqExpenses / totalCC) * 100 : 0;
                        const laborPct = totalCC > 0 ? (laborExpenses / totalCC) * 100 : 0;

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

                                    {/* View Toggling (The Dots) */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                            <span className="text-slate-500">
                                                {currentView === 'financial' ? 'Repartição de Custos' : 'Recursos da Unidade'}
                                            </span>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => toggleCardView(cc.id, 'financial')}
                                                    className={`w-2.5 h-2.5 rounded-full transition-all ${currentView === 'financial' ? 'bg-blue-500 scale-125 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-slate-700 hover:bg-slate-600'}`}
                                                />
                                                <button
                                                    onClick={() => toggleCardView(cc.id, 'operational')}
                                                    className={`w-2.5 h-2.5 rounded-full transition-all ${currentView === 'operational' ? 'bg-emerald-500 scale-125 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-700 hover:bg-slate-600'}`}
                                                />
                                            </div>
                                        </div>

                                        {currentView === 'financial' ? (
                                            <>
                                                <>
                                                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
                                                        {/* 5 Distinct Segments */}
                                                        <div className="h-full bg-blue-500" style={{ width: `${fuelPct}%` }} title={`Combustível: ${fuelPct.toFixed(1)}%`} />
                                                        <div className="h-full bg-cyan-400" style={{ width: `${chargingPct}%` }} title={`Carregamentos: ${chargingPct.toFixed(1)}%`} />
                                                        <div className="h-full bg-emerald-500" style={{ width: `${tollPct}%` }} title={`Via Verde: ${tollPct.toFixed(1)}%`} />
                                                        <div className="h-full bg-amber-500" style={{ width: `${reqPct}%` }} title={`Requisições: ${reqPct.toFixed(1)}%`} />
                                                        <div className="h-full bg-indigo-500" style={{ width: `${laborPct}%` }} title={`Mão de Obra: ${laborPct.toFixed(1)}%`} />
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                            <span>Fuel {fuelExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <div className="w-2 h-2 rounded-full bg-cyan-400" />
                                                            <span>EV {chargingExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                            <span>Tolls {tollExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                            <span>Reqs {reqExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                            <span>Team {laborExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            </>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-slate-900/30 p-2.5 rounded-xl border border-white/5">
                                                    <p className="text-[8px] text-slate-500 font-black uppercase mb-1 flex items-center gap-1">
                                                        <Users className="w-2 h-2" /> Motoristas Ativos
                                                    </p>
                                                    <div className="flex -space-x-2">
                                                        {ccDrivers.slice(0, 3).map((d, i) => (
                                                            <div key={i} title={d.nome} className="w-5 h-5 rounded-full bg-blue-600 border border-slate-900 flex items-center justify-center text-[8px] font-black text-white">
                                                                {d.nome.charAt(0)}
                                                            </div>
                                                        ))}
                                                        {ccDrivers.length > 3 && (
                                                            <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-400">
                                                                +{ccDrivers.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900/30 p-2.5 rounded-xl border border-white/5">
                                                    <p className="text-[8px] text-slate-500 font-black uppercase mb-1 flex items-center gap-1">
                                                        <Car className="w-2 h-2" /> Frota Dedicada
                                                    </p>
                                                    <div className="font-bold text-[10px] text-slate-300">
                                                        {fuelTransactions.filter(t => t.centroCustoId === cc.id)
                                                            .reduce((acc: string[], t) => {
                                                                const v = viaturas.find(vi => vi.id === t.vehicleId);
                                                                if (v && !acc.includes(v.matricula)) acc.push(v.matricula);
                                                                return acc;
                                                            }, []).length} Viaturas
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Footnote */}
                                    <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
                                        <button
                                            onClick={() => setSelectedCC(cc)}
                                            className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 active:scale-95"
                                        >
                                            Ver Relatório <ChevronRight className="w-3 h-3" />
                                        </button>
                                        <div className="flex gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full transition-all ${totalCC > 5000 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Details Modal */}
            {selectedCC && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 scale-in-center">
                    <div className="bg-[#0f172a] w-full max-w-5xl h-[85vh] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tighter">Relatório Detalhado</h2>
                                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mt-1 uppercase tracking-widest">
                                    <Building2 className="w-4 h-4" />
                                    {selectedCC.nome}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => exportCCReport(selectedCC)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-sm active:scale-95"
                                >
                                    <Download className="w-4 h-4" /> Exportar PDF
                                </button>
                                <button
                                    onClick={() => setSelectedCC(null)}
                                    className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                            {/* Stats Overview */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/5">
                                    <Fuel className="w-6 h-6 text-blue-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Combustível</p>
                                    <p className="text-xl font-black text-white">
                                        {fuelTransactions.filter(t => t.centroCustoId === selectedCC.id)
                                            .reduce((sum, t) => sum + (t.totalCost || 0), 0)
                                            .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/5">
                                    <Zap className="w-6 h-6 text-cyan-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Carregamentos</p>
                                    <p className="text-xl font-black text-white">
                                        {(charging || []).filter(c => c.cost_center_id === selectedCC.id)
                                            .reduce((sum, c) => sum + (c.cost || 0), 0)
                                            .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/5">
                                    <Wallet className="w-6 h-6 text-emerald-500 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Via Verde</p>
                                    <p className="text-xl font-black text-white">
                                        {(tolls || []).filter(t => t.cost_center_id === selectedCC.id)
                                            .reduce((sum, t) => sum + (t.amount || 0), 0)
                                            .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/5">
                                    <Building2 className="w-6 h-6 text-amber-500 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Requisições</p>
                                    <p className="text-xl font-black text-white">
                                        {requisicoes.filter(r => r.centroCustoId === selectedCC.id)
                                            .reduce((sum, r) => sum + (r.custo || 0), 0)
                                            .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/5">
                                    <Users className="w-6 h-6 text-indigo-500 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Mão de Obra</p>
                                    <p className="text-xl font-black text-white">
                                        {motoristas.filter(m => m.centroCustoId === selectedCC.id)
                                            .reduce((sum, m) => sum + (m.vencimentoBase || 0), 0)
                                            .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                    </p>
                                </div>
                            </div>

                            {/* Tables Container */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                {/* Fuel Transactions Table */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">Histórico de Abastecimento</h3>
                                    <div className="bg-slate-950/40 rounded-3xl border border-white/5 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#020617] text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Data</th>
                                                    <th className="px-6 py-4">Viatura</th>
                                                    <th className="px-6 py-4 text-right">Custo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {fuelTransactions.filter(t => t.centroCustoId === selectedCC.id).slice(0, 5).map((t, i) => (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 text-slate-400">{new Date(t.timestamp).toLocaleDateString('pt-PT')}</td>
                                                        <td className="px-6 py-4 text-white font-bold">{viaturas.find(v => v.id === t.vehicleId)?.matricula || '---'}</td>
                                                        <td className="px-6 py-4 text-right text-blue-400 font-mono font-bold">{(t.totalCost || 0).toFixed(2)}€</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Charging Table */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">Carregamentos Elétricos</h3>
                                    <div className="bg-slate-950/40 rounded-3xl border border-white/5 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#020617] text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Data</th>
                                                    <th className="px-6 py-4">Viatura</th>
                                                    <th className="px-6 py-4 text-right">kWh / Custo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {(charging || []).filter(c => c.cost_center_id === selectedCC.id).slice(0, 5).map((c, i) => (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 text-slate-400">{new Date(c.date).toLocaleDateString('pt-PT')}</td>
                                                        <td className="px-6 py-4 text-white font-bold">{viaturas.find(v => v.id === c.vehicle_id)?.matricula || '---'}</td>
                                                        <td className="px-6 py-4 text-right text-cyan-400 font-mono font-bold">
                                                            <div className="flex flex-col items-end">
                                                                <span>{(c.cost || 0).toFixed(2)}€</span>
                                                                <span className="text-[10px] text-slate-500">{(c.kwh || 0).toFixed(1)} kWh</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Via Verde Table */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">Via Verde</h3>
                                    <div className="bg-slate-950/40 rounded-3xl border border-white/5 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#020617] text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Data</th>
                                                    <th className="px-6 py-4">Detalhe</th>
                                                    <th className="px-6 py-4 text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {(tolls || []).filter(t => t.cost_center_id === selectedCC.id).slice(0, 5).map((t, i) => (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 text-slate-400">{new Date(t.entry_time).toLocaleDateString('pt-PT')}</td>
                                                        <td className="px-6 py-4 text-white font-bold text-xs truncate max-w-[150px]">
                                                            {t.type === 'parking' ? t.entry_point : `${t.entry_point} -> ${t.exit_point}`}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-emerald-500 font-mono font-bold">{(t.amount || 0).toFixed(2)}€</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Requisitions Table */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">Requisições e Peças</h3>
                                    <div className="bg-slate-950/40 rounded-3xl border border-white/5 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#020617] text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Data</th>
                                                    <th className="px-6 py-4">Item</th>
                                                    <th className="px-6 py-4 text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {requisicoes.filter(r => r.centroCustoId === selectedCC.id).slice(0, 5).map((r, i) => (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 text-slate-400">{new Date(r.data).toLocaleDateString('pt-PT')}</td>
                                                        <td className="px-6 py-4 text-white font-bold truncate max-w-[150px]">{r.itens?.map(i => i.descricao).join(', ') || '---'}</td>
                                                        <td className="px-6 py-4 text-right text-amber-500 font-mono font-bold">{(r.custo || 0).toFixed(2)}€</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Creation Form Modal */}
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
