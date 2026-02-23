import React, { useState, useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useFinancial } from '../../contexts/FinancialContext';
import {
    Plus, Trash2, Building2, MapPin, X, Download, Users, Car, Fuel,
    Wallet, ChevronRight, Zap, Wrench, TrendingUp, TrendingDown, Minus,
    ArrowUpRight, ArrowDownRight, Trophy, AlertTriangle, BarChart3,
    Calendar, Filter, ChevronLeft, Info
} from 'lucide-react';
import type { CentroCusto } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';

/* ─── helpers ─── */
const eur = (n: number) => n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

type Period = '1m' | '3m' | '6m' | '1y' | 'all';
const PERIODS: { id: Period; label: string }[] = [
    { id: '1m', label: '1 Mês' },
    { id: '3m', label: '3 Meses' },
    { id: '6m', label: '6 Meses' },
    { id: '1y', label: '1 Ano' },
    { id: 'all', label: 'Tudo' },
];

function periodStart(p: Period): Date {
    const d = new Date();
    if (p === '1m') d.setMonth(d.getMonth() - 1);
    else if (p === '3m') d.setMonth(d.getMonth() - 3);
    else if (p === '6m') d.setMonth(d.getMonth() - 6);
    else if (p === '1y') d.setFullYear(d.getFullYear() - 1);
    else return new Date(0);
    return d;
}

function prevPeriodStart(p: Period): Date {
    const d = new Date();
    if (p === '1m') d.setMonth(d.getMonth() - 2);
    else if (p === '3m') d.setMonth(d.getMonth() - 6);
    else if (p === '6m') d.setMonth(d.getMonth() - 12);
    else if (p === '1y') d.setFullYear(d.getFullYear() - 2);
    else return new Date(0);
    return d;
}

/* ─── Tooltip component ─── */
function CostTooltip({ items }: { items: { label: string; value: number; color: string }[] }) {
    const total = items.reduce((a, i) => a + i.value, 0);
    return (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl min-w-[200px] text-xs pointer-events-none">
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-2">Repartição</p>
            {items.map(i => (
                <div key={i.label} className="flex justify-between items-center gap-4 py-0.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: i.color }} />
                        <span className="text-slate-300">{i.label}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-white font-bold">{eur(i.value)}</span>
                        <span className="text-slate-500 ml-1">({total > 0 ? ((i.value / total) * 100).toFixed(0) : 0}%)</span>
                    </div>
                </div>
            ))}
            <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between">
                <span className="text-slate-400">Total</span>
                <span className="text-white font-black">{eur(total)}</span>
            </div>
        </div>
    );
}

/* ─── Stacked bar with tooltip ─── */
function CostBar({ fuel, charging, tolls, reqs, labor }: { fuel: number; charging: number; tolls: number; reqs: number; labor: number }) {
    const [show, setShow] = useState(false);
    const total = fuel + charging + tolls + reqs + labor;
    const items = [
        { label: 'Combustível', value: fuel, color: '#3b82f6' },
        { label: 'Carregamentos EV', value: charging, color: '#22d3ee' },
        { label: 'Via Verde', value: tolls, color: '#10b981' },
        { label: 'Requisições', value: reqs, color: '#f59e0b' },
        { label: 'Mão de Obra', value: labor, color: '#6366f1' },
    ].filter(i => i.value > 0);

    return (
        <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {show && <CostTooltip items={items} />}
            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden flex cursor-help shadow-inner">
                {items.map(i => (
                    <div key={i.label} className="h-full transition-all" style={{ width: `${(i.value / (total || 1)) * 100}%`, backgroundColor: i.color }} />
                ))}
            </div>
            <div className="flex items-center gap-1 mt-1">
                <Info className="w-2.5 h-2.5 text-slate-600" />
                <span className="text-[9px] text-slate-600">Passe o rato para detalhes</span>
            </div>
        </div>
    );
}

/* ─── Variation badge ─── */
function VarBadge({ pct: p }: { pct: number | null }) {
    if (p === null) return <span className="text-[9px] text-slate-500 font-bold">Sem histórico</span>;
    if (Math.abs(p) < 2) return (
        <span className="flex items-center gap-0.5 text-slate-400 text-[10px] font-bold">
            <Minus className="w-3 h-3" />Estável
        </span>
    );
    if (p > 0) return (
        <span className="flex items-center gap-0.5 text-red-400 text-[10px] font-bold">
            <ArrowUpRight className="w-3 h-3" />{Math.abs(p).toFixed(1)}% vs anterior
        </span>
    );
    return (
        <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] font-bold">
            <ArrowDownRight className="w-3 h-3" />{Math.abs(p).toFixed(1)}% vs anterior
        </span>
    );
}

/* ─── Dynamic health indicator ─── */
function HealthBadge({ variation }: { variation: number | null }) {
    if (variation === null) return <span className="text-xs text-slate-500 font-bold px-2 py-0.5 rounded-full bg-slate-800">Novo</span>;
    if (variation > 20) return <span className="text-xs text-red-400 font-black px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Crítico</span>;
    if (variation > 5) return <span className="text-xs text-amber-400 font-black px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Em Crescimento</span>;
    if (variation < -5) return <span className="text-xs text-emerald-400 font-black px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1"><TrendingDown className="w-3 h-3" />A Melhorar</span>;
    return <span className="text-xs text-blue-400 font-black px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">Estável</span>;
}

/* ════════════════════════════════════════════════ MAIN ════════════════ */
export default function CentrosCustos() {
    const { centrosCustos, addCentroCusto, deleteCentroCusto, fuelTransactions, requisicoes, motoristas, manualHours, viaturas } = useWorkshop();
    const { tolls, charging } = useFinancial();

    const [showForm, setShowForm] = useState(false);
    const [selectedCC, setSelectedCC] = useState<CentroCusto | null>(null);
    const [period, setPeriod] = useState<Period>('3m');
    const [isRepairing, setIsRepairing] = useState(false);
    const [nome, setNome] = useState('');
    const [localizacao, setLocalizacao] = useState('');

    /* ─── period filtering ─── */
    const cutoff = useMemo(() => periodStart(period), [period]);
    const prevCutoff = useMemo(() => prevPeriodStart(period), [period]);

    const inPeriod = (ts: string) => new Date(ts) >= cutoff;
    const inPrev = (ts: string) => new Date(ts) >= prevCutoff && new Date(ts) < cutoff;

    /* ─── calculate CC stats for a filter fn ─── */
    const calcCC = (cc: CentroCusto, filter: (ts: string) => boolean) => {
        const fuel = fuelTransactions.filter(t => t.centroCustoId === cc.id && filter(t.timestamp));
        const ev = (charging || []).filter(c => c.cost_center_id === cc.id && filter(c.date));
        const vv = (tolls || []).filter(t => t.cost_center_id === cc.id && filter(t.entry_time));
        const req = requisicoes.filter(r => r.centroCustoId === cc.id && filter(r.data));
        const drivers = motoristas.filter(m => m.centroCustoId === cc.id);

        const now = new Date();
        let labor = 0;
        drivers.forEach(m => {
            const regDate = m.dataRegisto ? new Date(m.dataRegisto) : now;
            const months = Math.max(1, (now.getFullYear() - regDate.getFullYear()) * 12 + now.getMonth() - regDate.getMonth() + 1);
            if (m.vencimentoBase) labor += m.vencimentoBase * months;
        });
        manualHours.filter(mh => {
            const d = motoristas.find(m => m.id === mh.motoristaId);
            return d && d.centroCustoId === cc.id;
        }).forEach(mh => {
            const d = motoristas.find(m => m.id === mh.motoristaId);
            if (d?.valorHora) {
                const s = new Date(`1970-01-01T${mh.startTime}`);
                const e = new Date(`1970-01-01T${mh.endTime}`);
                let h = (e.getTime() - s.getTime()) / 3600000;
                if (h < 0) h += 24;
                const dur = h - (mh.breakDuration || 0) / 60;
                if (dur > 0) labor += dur * d.valorHora;
            }
        });

        const fuelCost = fuel.reduce((a, t) => a + (t.totalCost || 0), 0);
        const fuelLiters = fuel.reduce((a, t) => a + (t.liters || 0), 0);
        const evCost = ev.reduce((a, c) => a + (c.cost || 0), 0);
        const vvCost = vv.reduce((a, t) => a + (t.amount || 0), 0);
        const reqCost = req.reduce((a, r) => a + (r.custo || 0), 0);
        const total = fuelCost + evCost + vvCost + reqCost + labor;
        const eurPerLitre = fuelLiters > 0 ? fuelCost / fuelLiters : 0;

        return { fuelCost, evCost, vvCost, reqCost, labor, total, fuelLiters, eurPerLitre, drivers, fuel, ev, vv, req };
    };

    /* ─── build enriched list ─── */
    const enriched = useMemo(() => centrosCustos.map(cc => {
        const cur = calcCC(cc, inPeriod);
        const prev = calcCC(cc, inPrev);
        const variation = prev.total > 0 ? ((cur.total - prev.total) / prev.total) * 100 : null;
        return { cc, cur, prev, variation };
    }), [centrosCustos, fuelTransactions, requisicoes, motoristas, manualHours, tolls, charging, period]);

    /* ─── Rankings ─── */
    const byTotal = [...enriched].sort((a, b) => b.cur.total - a.cur.total);
    const byGrowth = [...enriched].filter(e => e.variation !== null).sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0));
    const byEfficiency = [...enriched].sort((a, b) => a.cur.total - b.cur.total);

    /* ─── global totals (current period) ─── */
    const grandTotal = enriched.reduce((a, e) => a + e.cur.total, 0);
    const globalFuel = enriched.reduce((a, e) => a + e.cur.fuelCost, 0);
    const globalEV = enriched.reduce((a, e) => a + e.cur.evCost, 0);
    const globalVV = enriched.reduce((a, e) => a + e.cur.vvCost, 0);
    const globalReq = enriched.reduce((a, e) => a + e.cur.reqCost, 0);
    const globalLabor = enriched.reduce((a, e) => a + e.cur.labor, 0);

    /* ─── handlers ─── */
    const handleRepairData = async () => {
        if (!confirm('Corrigir registos sem Centro de Custo baseado na viatura?')) return;
        setIsRepairing(true);
        try {
            const map = new Map<string, string>();
            viaturas.forEach(v => { if (v.centro_custo_id) map.set(v.id, v.centro_custo_id); });
            const { data: ch } = await supabase.from('electric_charging_records').select('id,vehicle_id').is('cost_center_id', null);
            if (ch) for (const r of ch) { const c = map.get(r.vehicle_id); if (c) await supabase.from('electric_charging_records').update({ cost_center_id: c }).eq('id', r.id); }
            const { data: vvd } = await supabase.from('via_verde_toll_records').select('id,vehicle_id').is('cost_center_id', null);
            if (vvd) for (const r of vvd) { const c = map.get(r.vehicle_id); if (c) await supabase.from('via_verde_toll_records').update({ cost_center_id: c }).eq('id', r.id); }
            alert('Concluído! A recarregar...');
            window.location.reload();
        } catch { alert('Erro.'); } finally { setIsRepairing(false); }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome) return;
        addCentroCusto({ id: crypto.randomUUID(), nome, localizacao });
        setShowForm(false); setNome(''); setLocalizacao('');
    };

    const exportCCReport = (cc: CentroCusto) => {
        const doc = new jsPDF();
        const now = new Date();
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(22);
        doc.text('Relatório de Centro de Custo', 15, 25);
        doc.setFontSize(10); doc.setTextColor(200, 200, 200);
        doc.text(`Unidade: ${cc.nome.toUpperCase()}`, 15, 33);
        doc.text(`Data: ${now.toLocaleDateString('pt-PT')}`, 140, 33);

        const { fuel, ev, vv, req, drivers } = calcCC(cc, inPeriod);
        let y = 50;
        const addSection = (title: string, head: string[][], body: string[][], color: [number, number, number]) => {
            doc.setTextColor(30, 41, 59); doc.setFontSize(14); doc.text(title, 15, y);
            autoTable(doc, { startY: y + 5, head, body, theme: 'striped', headStyles: { fillColor: color } });
            y = (doc as any).lastAutoTable.finalY + 15;
        };
        addSection('1. Combustível', [['Data', 'Viatura', 'Litros', 'Custo']],
            fuel.map(t => [new Date(t.timestamp).toLocaleDateString('pt-PT'), viaturas.find(v => v.id === t.vehicleId)?.matricula || '---', `${(t.liters || 0).toFixed(2)} L`, eur(t.totalCost || 0)]), [59, 130, 246]);
        addSection('2. Carregamentos EV', [['Data', 'Viatura', 'kWh', 'Custo']],
            ev.map(c => [new Date(c.date).toLocaleDateString('pt-PT'), viaturas.find(v => v.id === c.vehicle_id)?.matricula || '---', `${(c.kwh || 0).toFixed(2)} kWh`, eur(c.cost || 0)]), [34, 211, 238]);
        addSection('3. Requisições', [['Data', 'Descrição', 'Custo']],
            req.map(r => [new Date(r.data).toLocaleDateString('pt-PT'), r.itens?.map((i: any) => i.descricao).join(', ') || '---', eur(r.custo || 0)]), [245, 158, 11]);
        addSection('4. Via Verde', [['Data', 'Detalhe', 'Valor']],
            vv.map(t => [new Date(t.entry_time).toLocaleDateString('pt-PT'), t.type === 'parking' ? t.entry_point : `${t.entry_point} → ${t.exit_point}`, eur(t.amount || 0)]), [16, 185, 129]);
        addSection('5. Equipa', [['Motorista', 'Status', 'Salário']],
            drivers.map(m => [m.nome || '---', m.status || '---', eur(m.vencimentoBase || 0)]), [99, 102, 241]);
        doc.save(`Relatorio_${cc.nome.replace(/\s+/g, '_')}.pdf`);
    };

    /* ─── Selected CC detail panel ─── */
    const selectedEnriched = selectedCC ? enriched.find(e => e.cc.id === selectedCC.id) : null;

    /* ════════════════════════════════ RENDER ════════════════════════ */
    return (
        <div className="animate-in fade-in duration-500">

            <PageHeader
                title="Centros de Custos"
                subtitle="Análise operacional por unidade · variação automática vs período anterior"
                icon={Building2}
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">
                            <Plus className="w-5 h-5" /> Novo Centro
                        </button>
                        <button onClick={handleRepairData} disabled={isRepairing} title="Corrigir Centros"
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 disabled:opacity-50">
                            <Wrench className={`w-5 h-5 ${isRepairing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                }
            >
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit mt-4">
                    <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
                    {PERIODS.map(p => (
                        <button key={p.id} onClick={() => setPeriod(p.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </PageHeader>

            <div className="p-4 md:p-8 space-y-8">

                {/* ── GLOBAL KPIs ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div className="col-span-2 md:col-span-3 xl:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-5 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Despesa Global</p>
                        <p className="text-2xl font-black text-white">{eur(grandTotal)}</p>
                        <div className="mt-3 h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
                            <div className="h-full bg-blue-500" style={{ width: `${(globalFuel / (grandTotal || 1)) * 100}%` }} />
                            <div className="h-full bg-cyan-400" style={{ width: `${(globalEV / (grandTotal || 1)) * 100}%` }} />
                            <div className="h-full bg-emerald-500" style={{ width: `${(globalVV / (grandTotal || 1)) * 100}%` }} />
                            <div className="h-full bg-amber-500" style={{ width: `${(globalReq / (grandTotal || 1)) * 100}%` }} />
                            <div className="h-full bg-indigo-500" style={{ width: `${(globalLabor / (grandTotal || 1)) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{centrosCustos.length} centros · {PERIODS.find(p => p.id === period)?.label}</p>
                    </div>
                    {[
                        { label: 'Combustível', val: globalFuel, color: 'bg-blue-500/5 border-blue-500/20', text: 'text-blue-400' },
                        { label: 'Carregamentos EV', val: globalEV, color: 'bg-cyan-500/5 border-cyan-500/20', text: 'text-cyan-400' },
                        { label: 'Via Verde', val: globalVV, color: 'bg-emerald-500/5 border-emerald-500/20', text: 'text-emerald-400' },
                        { label: 'Requisições', val: globalReq, color: 'bg-amber-500/5 border-amber-500/20', text: 'text-amber-400' },
                        { label: 'Mão de Obra', val: globalLabor, color: 'bg-indigo-500/5 border-indigo-500/20', text: 'text-indigo-400' },
                    ].map(k => (
                        <div key={k.label} className={`${k.color} border p-4 rounded-3xl backdrop-blur-md`}>
                            <p className={`${k.text} text-[10px] font-black uppercase tracking-widest mb-1`}>{k.label}</p>
                            <p className="text-lg font-bold text-white">{eur(k.val)}</p>
                            <p className="text-[10px] text-slate-500">{((k.val / (grandTotal || 1)) * 100).toFixed(1)}% do total</p>
                        </div>
                    ))}
                </div>

                {/* ── RANKINGS ── */}
                {enriched.length >= 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            {
                                title: '🔴 Maior Custo', icon: Trophy, color: 'border-red-500/20 bg-red-500/5',
                                items: byTotal.slice(0, 3).map((e, i) => ({ label: e.cc.nome, sub: eur(e.cur.total), rank: i }))
                            },
                            {
                                title: '📈 Maior Crescimento', icon: TrendingUp, color: 'border-amber-500/20 bg-amber-500/5',
                                items: byGrowth.slice(0, 3).map((e, i) => ({ label: e.cc.nome, sub: e.variation !== null ? pct(e.variation!) : '-', rank: i }))
                            },
                            {
                                title: '🟢 Mais Eficiente', icon: TrendingDown, color: 'border-emerald-500/20 bg-emerald-500/5',
                                items: byEfficiency.slice(0, 3).map((e, i) => ({ label: e.cc.nome, sub: eur(e.cur.total), rank: i }))
                            },
                        ].map(r => (
                            <div key={r.title} className={`${r.color} border rounded-2xl p-4`}>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">{r.title}</p>
                                {r.items.map((item, i) => (
                                    <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                                        <span className="text-slate-600 font-black text-sm w-4">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-bold truncate">{item.label}</p>
                                        </div>
                                        <span className="text-slate-300 text-xs font-bold">{item.sub}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── CC CARDS GRID ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {enriched.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center p-20 bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-800">
                            <Building2 className="w-16 h-16 text-slate-700 mb-4" />
                            <h3 className="text-xl font-bold text-slate-400">Sem Centros Registados</h3>
                            <p className="text-slate-500 text-sm mt-1">Adicione o primeiro centro de custo.</p>
                        </div>
                    ) : enriched.map(({ cc, cur, variation }) => (
                        <div
                            key={cc.id}
                            onClick={() => setSelectedCC(cc)}
                            className={`group relative bg-[#0f172a] border rounded-3xl overflow-visible cursor-pointer hover:border-blue-500/60 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300
                            ${variation !== null && variation > 20 ? 'border-red-500/40' : variation !== null && variation > 5 ? 'border-amber-500/30' : 'border-slate-800'}`}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all" />

                            <div className="p-6">
                                {/* Card header */}
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600 group-hover:border-blue-500 transition-all">
                                            <Building2 className="w-6 h-6 text-blue-400 group-hover:text-white transition-colors" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{cc.nome}</h3>
                                            {cc.localizacao && (
                                                <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                                                    <MapPin className="w-2.5 h-2.5" />{cc.localizacao}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <HealthBadge variation={variation} />
                                        <button onClick={e => { e.stopPropagation(); deleteCentroCusto(cc.id); }}
                                            className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Cost */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-end mb-1">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Custo Acumulado</p>
                                        <VarBadge pct={variation ?? null} />
                                    </div>
                                    <p className="text-3xl font-black text-white tracking-tighter">{eur(cur.total)}</p>
                                </div>

                                {/* Cost bar with tooltip */}
                                <div className="mb-5">
                                    <CostBar fuel={cur.fuelCost} charging={cur.evCost} tolls={cur.vvCost} reqs={cur.reqCost} labor={cur.labor} />
                                </div>

                                {/* Key metrics */}
                                <div className="grid grid-cols-3 gap-2 mb-5">
                                    <div className="bg-slate-950/50 border border-slate-800/50 p-2.5 rounded-xl text-center">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Motoristas</p>
                                        <p className="text-sm font-bold text-white">{cur.drivers.length}</p>
                                    </div>
                                    <div className="bg-slate-950/50 border border-slate-800/50 p-2.5 rounded-xl text-center">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Litros</p>
                                        <p className="text-sm font-bold text-white">{cur.fuelLiters.toFixed(0)}L</p>
                                    </div>
                                    <div className="bg-slate-950/50 border border-slate-800/50 p-2.5 rounded-xl text-center">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-1">€/Litro</p>
                                        <p className="text-sm font-bold text-white">{cur.eurPerLitre > 0 ? cur.eurPerLitre.toFixed(3) : '—'}</p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 group-hover:text-blue-300 flex items-center gap-1">
                                        Ver Dashboard <ChevronRight className="w-3 h-3" />
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                        <Calendar className="w-3 h-3" />
                                        {PERIODS.find(p => p.id === period)?.label}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ══════════════ DETAIL PANEL ══════════════ */}
                {selectedCC && selectedEnriched && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[100] p-4">
                        <div className="bg-[#0f172a] w-full max-w-5xl h-[90vh] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">

                            {/* Modal header */}
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedCC(null)} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tighter">{selectedCC.nome}</h2>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {selectedCC.localizacao && <span className="text-slate-500 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedCC.localizacao}</span>}
                                            <HealthBadge variation={selectedEnriched.variation ?? null} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => exportCCReport(selectedCC)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-sm">
                                        <Download className="w-4 h-4" />PDF
                                    </button>
                                    <button onClick={() => setSelectedCC(null)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                                {/* Cost overview */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Custo Total', val: selectedEnriched.cur.total, icon: BarChart3, color: 'text-white' },
                                        { label: 'vs Período Anterior', val: null, var: selectedEnriched.variation, icon: TrendingUp, color: '' },
                                        { label: '€/Litro Médio', val: selectedEnriched.cur.eurPerLitre, icon: Fuel, color: 'text-blue-400', suffix: ' €/L' },
                                        { label: 'Abastecimentos', val: selectedEnriched.cur.fuel.length, icon: Fuel, color: 'text-amber-400', noEur: true },
                                    ].map((k, i) => (
                                        <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                                            <k.icon className={`w-5 h-5 ${k.color || 'text-slate-400'} mb-2`} />
                                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{k.label}</p>
                                            {k.var !== undefined ? (
                                                <div className="mt-1"><VarBadge pct={k.var ?? null} /></div>
                                            ) : k.noEur ? (
                                                <p className="text-xl font-black text-white">{k.val}</p>
                                            ) : (
                                                <p className={`text-xl font-black ${k.color || 'text-white'}`}>
                                                    {k.val !== null && k.val !== undefined ? (k.suffix ? `${(k.val as number).toFixed(3)}${k.suffix}` : eur(k.val as number)) : '—'}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Category breakdown */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {[
                                        { label: 'Combustível', val: selectedEnriched.cur.fuelCost, icon: Fuel, color: 'text-blue-400' },
                                        { label: 'Carregamentos EV', val: selectedEnriched.cur.evCost, icon: Zap, color: 'text-cyan-400' },
                                        { label: 'Via Verde', val: selectedEnriched.cur.vvCost, icon: Wallet, color: 'text-emerald-400' },
                                        { label: 'Requisições', val: selectedEnriched.cur.reqCost, icon: Building2, color: 'text-amber-400' },
                                        { label: 'Mão de Obra', val: selectedEnriched.cur.labor, icon: Users, color: 'text-indigo-400' },
                                    ].map(k => (
                                        <div key={k.label} className="bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                                            <k.icon className={`w-5 h-5 ${k.color} mb-2`} />
                                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{k.label}</p>
                                            <p className="text-lg font-black text-white">{eur(k.val)}</p>
                                            <p className="text-[10px] text-slate-600">
                                                {selectedEnriched.cur.total > 0 ? ((k.val / selectedEnriched.cur.total) * 100).toFixed(0) : 0}% do total
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Transaction tables */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                                    {/* Fuel */}
                                    <div>
                                        <h3 className="text-sm font-black text-white flex items-center gap-2 mb-3">
                                            <Fuel className="w-4 h-4 text-blue-400" />Abastecimentos ({selectedEnriched.cur.fuel.length})
                                        </h3>
                                        <div className="bg-slate-950/40 rounded-2xl border border-white/5 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#020617] text-slate-500 font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3">Data</th>
                                                        <th className="px-4 py-3">Viatura</th>
                                                        <th className="px-4 py-3">Litros</th>
                                                        <th className="px-4 py-3 text-right">Custo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {selectedEnriched.cur.fuel.slice(0, 8).map((t, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-400">{new Date(t.timestamp).toLocaleDateString('pt-PT')}</td>
                                                            <td className="px-4 py-2.5 text-white font-bold">{viaturas.find(v => v.id === t.vehicleId)?.matricula || '---'}</td>
                                                            <td className="px-4 py-2.5 text-slate-300">{(t.liters || 0).toFixed(1)}L</td>
                                                            <td className="px-4 py-2.5 text-right text-blue-400 font-mono font-bold">{(t.totalCost || 0).toFixed(2)}€</td>
                                                        </tr>
                                                    ))}
                                                    {selectedEnriched.cur.fuel.length === 0 && (
                                                        <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-600">Sem registos no período</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Via Verde */}
                                    <div>
                                        <h3 className="text-sm font-black text-white flex items-center gap-2 mb-3">
                                            <Wallet className="w-4 h-4 text-emerald-400" />Via Verde ({selectedEnriched.cur.vv.length})
                                        </h3>
                                        <div className="bg-slate-950/40 rounded-2xl border border-white/5 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#020617] text-slate-500 font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3">Data</th>
                                                        <th className="px-4 py-3">Detalhe</th>
                                                        <th className="px-4 py-3 text-right">Valor</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {selectedEnriched.cur.vv.slice(0, 8).map((t, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-400">{new Date(t.entry_time).toLocaleDateString('pt-PT')}</td>
                                                            <td className="px-4 py-2.5 text-white text-xs truncate max-w-[140px]">{t.type === 'parking' ? t.entry_point : `${t.entry_point} → ${t.exit_point}`}</td>
                                                            <td className="px-4 py-2.5 text-right text-emerald-400 font-mono font-bold">{(t.amount || 0).toFixed(2)}€</td>
                                                        </tr>
                                                    ))}
                                                    {selectedEnriched.cur.vv.length === 0 && (
                                                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-600">Sem registos no período</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* EV */}
                                    <div>
                                        <h3 className="text-sm font-black text-white flex items-center gap-2 mb-3">
                                            <Zap className="w-4 h-4 text-cyan-400" />Carregamentos EV ({selectedEnriched.cur.ev.length})
                                        </h3>
                                        <div className="bg-slate-950/40 rounded-2xl border border-white/5 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#020617] text-slate-500 font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3">Data</th>
                                                        <th className="px-4 py-3">Viatura</th>
                                                        <th className="px-4 py-3 text-right">kWh / Custo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {selectedEnriched.cur.ev.slice(0, 8).map((c, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-400">{new Date(c.date).toLocaleDateString('pt-PT')}</td>
                                                            <td className="px-4 py-2.5 text-white font-bold">{viaturas.find(v => v.id === c.vehicle_id)?.matricula || '---'}</td>
                                                            <td className="px-4 py-2.5 text-right text-cyan-400 font-mono font-bold">{(c.kwh || 0).toFixed(1)} kWh · {(c.cost || 0).toFixed(2)}€</td>
                                                        </tr>
                                                    ))}
                                                    {selectedEnriched.cur.ev.length === 0 && (
                                                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-600">Sem registos no período</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Requisições */}
                                    <div>
                                        <h3 className="text-sm font-black text-white flex items-center gap-2 mb-3">
                                            <Car className="w-4 h-4 text-amber-400" />Requisições ({selectedEnriched.cur.req.length})
                                        </h3>
                                        <div className="bg-slate-950/40 rounded-2xl border border-white/5 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#020617] text-slate-500 font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3">Data</th>
                                                        <th className="px-4 py-3">Descrição</th>
                                                        <th className="px-4 py-3 text-right">Custo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {selectedEnriched.cur.req.slice(0, 8).map((r, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-2.5 text-slate-400">{new Date(r.data).toLocaleDateString('pt-PT')}</td>
                                                            <td className="px-4 py-2.5 text-white truncate max-w-[160px]">{r.itens?.map((it: any) => it.descricao).join(', ') || '---'}</td>
                                                            <td className="px-4 py-2.5 text-right text-amber-400 font-mono font-bold">{(r.custo || 0).toFixed(2)}€</td>
                                                        </tr>
                                                    ))}
                                                    {selectedEnriched.cur.req.length === 0 && (
                                                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-600">Sem registos no período</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Team */}
                                {selectedEnriched.cur.drivers.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-black text-white flex items-center gap-2 mb-3">
                                            <Users className="w-4 h-4 text-indigo-400" />Equipa ({selectedEnriched.cur.drivers.length})
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedEnriched.cur.drivers.map(d => (
                                                <div key={d.id} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                                                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white">{d.nome.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-white text-xs font-bold">{d.nome}</p>
                                                        <p className="text-slate-500 text-[10px]">{eur(d.vencimentoBase || 0)}/mês</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── NEW CC FORM ── */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
                        <div className="bg-[#0f172a] w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                            <div className="p-8 border-b border-slate-800">
                                <h2 className="text-2xl font-black text-white">Nova Unidade</h2>
                                <p className="text-slate-500 text-sm mt-1">Registe um novo centro de custo.</p>
                            </div>
                            <form onSubmit={handleSubmit} className="p-8 space-y-5">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nome / Escritório</label>
                                    <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                                        className="w-full bg-[#020617] border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                                        placeholder="Ex: Escritório Lisboa" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Localização (Opcional)</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                        <input type="text" value={localizacao} onChange={e => setLocalizacao(e.target.value)}
                                            className="w-full bg-[#020617] border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                                            placeholder="Ex: Av. da Liberdade" />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-6 py-4 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl font-bold transition-all">Cancelar</button>
                                    <button type="submit" className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-500/20">Confirmar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
