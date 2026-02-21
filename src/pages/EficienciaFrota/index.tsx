import { useState, useMemo } from 'react';
import {
    Gauge, Car, Users, Calendar, TrendingUp, TrendingDown,
    AlertTriangle, CheckCircle, XCircle, Fuel, DollarSign,
    BarChart3, Activity, ChevronDown, ChevronUp, Info,
    ArrowUpRight, ArrowDownRight, Minus, Award
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';

/* ─────────────────────────────────────────────
   CALCULATION ENGINE
───────────────────────────────────────────── */

interface FuelSegment {
    transactionId: string;
    vehicleId: string;
    driverId?: string;
    timestamp: string;
    liters: number;
    km: number;
    kmPercorridos: number;         // km since last refuel
    consumo: number;               // L/100km
    custo: number;                 // total cost €
    custoKm: number;               // €/km
    pricePerLiter: number;
    isAnormal: boolean;
    isExternal: boolean;
}

interface VehicleStats {
    vehicleId: string;
    matricula: string;
    marca: string;
    modelo: string;
    kmTotal: number;
    litrosTotal: number;
    consumoMedio: number;          // L/100km
    custoTotal: number;            // €
    custoKmMedio: number;          // €/km
    driverIds: string[];
    segmentos: FuelSegment[];
    score: number;                 // 0-100 efficiency score
    tendencia: 'up' | 'down' | 'stable'; // consumption trend
    alerta: 'normal' | 'alto' | 'critico';
}

interface DriverStats {
    driverId: string;
    nome: string;
    kmConduzidos: number;
    consumoMedio: number;
    custoTotal: number;
    custoKmMedio: number;
    abastecimentos: number;
    veiculosUsados: string[];
    alerta: 'normal' | 'alto' | 'critico';
}

interface MonthStats {
    mes: string;  // "YYYY-MM"
    label: string;
    custoKmMedio: number;
    litrosTotal: number;
    custoTotal: number;
    kmTotal: number;
    abastecimentos: number;
    tendencia: 'up' | 'down' | 'stable';
}

/* Calculates consumption and cost-per-km for each refuel event */
function buildSegments(
    fuelTransactions: any[],
    _viaturas: any[],
    _motoristas: any[]
): FuelSegment[] {
    const confirmed = fuelTransactions.filter(t => t.status === 'confirmed' || t.isExternal);
    const sorted = [...confirmed].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Group by vehicle
    const byVehicle: Record<string, typeof sorted> = {};
    sorted.forEach(t => {
        const vid = (t.vehicleId || t.vehicle_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!vid) return;
        if (!byVehicle[vid]) byVehicle[vid] = [];
        byVehicle[vid].push(t);
    });

    const segments: FuelSegment[] = [];

    Object.entries(byVehicle).forEach(([, txns]) => {
        for (let i = 1; i < txns.length; i++) {
            const current = txns[i];
            const prev = txns[i - 1];

            const kmPercorridos = (current.km || 0) - (prev.km || 0);
            if (kmPercorridos <= 0 || kmPercorridos > 2000) continue; // Sanity check

            const liters = current.liters || 0;
            if (liters <= 0) continue;

            const consumo = (liters / kmPercorridos) * 100;
            const custo = current.totalCost || current.total_cost || 0;
            const custoKm = custo > 0 ? custo / kmPercorridos : 0;
            const pricePerLiter = current.pricePerLiter || current.price_per_liter || 0;

            segments.push({
                transactionId: current.id,
                vehicleId: current.vehicleId || current.vehicle_id || '',
                driverId: current.driverId || current.driver_id || '',
                timestamp: current.timestamp,
                liters,
                km: current.km || 0,
                kmPercorridos,
                consumo,
                custo,
                custoKm,
                pricePerLiter,
                isAnormal: false, // will be set later
                isExternal: !!(current.isExternal || current.is_external)
            });
        }
    });

    // Flag anomalies: consumption > 15% above vehicle average
    const byVehicleId: Record<string, FuelSegment[]> = {};
    segments.forEach(s => {
        if (!byVehicleId[s.vehicleId]) byVehicleId[s.vehicleId] = [];
        byVehicleId[s.vehicleId].push(s);
    });

    Object.values(byVehicleId).forEach(segs => {
        if (segs.length < 2) return;
        const avgConsumo = segs.reduce((a, s) => a + s.consumo, 0) / segs.length;
        segs.forEach(s => {
            s.isAnormal = s.consumo > avgConsumo * 1.15;
        });
    });

    return segments;
}

function calcVehicleStats(
    segments: FuelSegment[],
    viaturas: any[]
): VehicleStats[] {
    const byVehicle: Record<string, FuelSegment[]> = {};
    segments.forEach(s => {
        const vid = s.vehicleId;
        if (!byVehicle[vid]) byVehicle[vid] = [];
        byVehicle[vid].push(s);
    });

    return Object.entries(byVehicle).map(([vehicleId, segs]) => {
        const v = viaturas.find(v =>
            (v.matricula || '').toLowerCase().replace(/[^a-z0-9]/g, '') ===
            vehicleId.toLowerCase().replace(/[^a-z0-9]/g, '')
        );

        const kmTotal = segs.reduce((a, s) => a + s.kmPercorridos, 0);
        const litrosTotal = segs.reduce((a, s) => a + s.liters, 0);
        const custoTotal = segs.reduce((a, s) => a + s.custo, 0);
        const consumoMedio = kmTotal > 0 ? (litrosTotal / kmTotal) * 100 : 0;
        const custoKmMedio = kmTotal > 0 ? custoTotal / kmTotal : 0;

        const driverIds = [...new Set(segs.map(s => s.driverId).filter(Boolean))] as string[];

        // Efficiency score (0-100): lower consumption = higher score
        // Reference: 8 L/100km = 70 points. 12 = 40. 6 = 90.
        const baseScore = Math.max(0, Math.min(100, 110 - consumoMedio * 5));
        const score = Math.round(baseScore);

        // Trend: compare last 3 vs previous 3 segments
        let tendencia: 'up' | 'down' | 'stable' = 'stable';
        if (segs.length >= 6) {
            const recent = segs.slice(-3).reduce((a, s) => a + s.consumo, 0) / 3;
            const older = segs.slice(-6, -3).reduce((a, s) => a + s.consumo, 0) / 3;
            const diff = ((recent - older) / older) * 100;
            if (diff > 5) tendencia = 'up';
            else if (diff < -5) tendencia = 'down';
        }

        // Alert level
        let alerta: 'normal' | 'alto' | 'critico' = 'normal';
        if (consumoMedio > 18) alerta = 'critico';
        else if (consumoMedio > 12) alerta = 'alto';

        return {
            vehicleId,
            matricula: v?.matricula || vehicleId,
            marca: v?.marca || '-',
            modelo: v?.modelo || '-',
            kmTotal,
            litrosTotal,
            consumoMedio,
            custoTotal,
            custoKmMedio,
            driverIds,
            segmentos: segs,
            score,
            tendencia,
            alerta
        };
    }).sort((a, b) => b.custoKmMedio - a.custoKmMedio);
}

function calcDriverStats(
    segments: FuelSegment[],
    motoristas: any[]
): DriverStats[] {
    const byDriver: Record<string, FuelSegment[]> = {};
    segments.forEach(s => {
        const did = s.driverId;
        if (!did) return;
        if (!byDriver[did]) byDriver[did] = [];
        byDriver[did].push(s);
    });

    return Object.entries(byDriver).map(([driverId, segs]) => {
        const m = motoristas.find(m => m.id === driverId);

        const kmConduzidos = segs.reduce((a, s) => a + s.kmPercorridos, 0);
        const litrosTotal = segs.reduce((a, s) => a + s.liters, 0);
        const custoTotal = segs.reduce((a, s) => a + s.custo, 0);
        const consumoMedio = kmConduzidos > 0 ? (litrosTotal / kmConduzidos) * 100 : 0;
        const custoKmMedio = kmConduzidos > 0 ? custoTotal / kmConduzidos : 0;
        const veiculosUsados = [...new Set(segs.map(s => s.vehicleId))] as string[];

        let alerta: 'normal' | 'alto' | 'critico' = 'normal';
        if (consumoMedio > 18) alerta = 'critico';
        else if (consumoMedio > 12) alerta = 'alto';

        return {
            driverId,
            nome: m?.nome || 'Motorista Desconhecido',
            kmConduzidos,
            consumoMedio,
            custoTotal,
            custoKmMedio,
            abastecimentos: segs.length,
            veiculosUsados,
            alerta
        };
    }).sort((a, b) => b.custoKmMedio - a.custoKmMedio);
}

function calcMonthStats(segments: FuelSegment[]): MonthStats[] {
    const byMonth: Record<string, FuelSegment[]> = {};
    segments.forEach(s => {
        const mes = s.timestamp.slice(0, 7); // YYYY-MM
        if (!byMonth[mes]) byMonth[mes] = [];
        byMonth[mes].push(s);
    });

    const months = Object.entries(byMonth).map(([mes, segs]) => {
        const kmTotal = segs.reduce((a, s) => a + s.kmPercorridos, 0);
        const litrosTotal = segs.reduce((a, s) => a + s.liters, 0);
        const custoTotal = segs.reduce((a, s) => a + s.custo, 0);
        const custoKmMedio = kmTotal > 0 ? custoTotal / kmTotal : 0;

        const [year, month] = mes.split('-');
        const d = new Date(Number(year), Number(month) - 1, 1);
        const label = d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });

        return {
            mes,
            label,
            custoKmMedio,
            litrosTotal,
            custoTotal,
            kmTotal,
            abastecimentos: segs.length,
            tendencia: 'stable' as 'up' | 'down' | 'stable'
        };
    }).sort((a, b) => a.mes.localeCompare(b.mes));

    // Compute tendency compared to previous month
    for (let i = 1; i < months.length; i++) {
        const diff = months[i].custoKmMedio - months[i - 1].custoKmMedio;
        const pct = months[i - 1].custoKmMedio > 0 ? (diff / months[i - 1].custoKmMedio) * 100 : 0;
        if (pct > 3) months[i].tendencia = 'up';
        else if (pct < -3) months[i].tendencia = 'down';
    }

    return months;
}

/* ─────────────────────────────────────────────
   UI COMPONENTS
───────────────────────────────────────────── */

const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtEur = (n: number) => `${n.toFixed(2)} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function ScoreBadge({ score }: { score: number }) {
    return (
        <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle
                    cx="18" cy="18" r="16" fill="none"
                    stroke="url(#scoreGrad)" strokeWidth="3"
                    strokeDasharray={`${(score / 100) * 100.53} 100.53`}
                    strokeLinecap="round"
                />
                <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'} />
                        <stop offset="100%" stopColor={score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'} />
                    </linearGradient>
                </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">{score}</span>
        </div>
    );
}

function AlertBadge({ level }: { level: 'normal' | 'alto' | 'critico' }) {
    if (level === 'normal') return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" />Normal</span>;
    if (level === 'alto') return <span className="flex items-center gap-1 text-amber-400 text-xs"><AlertTriangle className="w-3.5 h-3.5" />Alto</span>;
    return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Verificar</span>;
}

function TrendIcon({ dir, pct }: { dir: 'up' | 'down' | 'stable'; pct?: number }) {
    if (dir === 'up') return <span className="flex items-center gap-0.5 text-red-400 text-xs font-bold"><ArrowUpRight className="w-3.5 h-3.5" />{pct ? `+${fmtPct(pct)}` : '↑'}</span>;
    if (dir === 'down') return <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-bold"><ArrowDownRight className="w-3.5 h-3.5" />{pct ? fmtPct(pct) : '↓'}</span>;
    return <span className="flex items-center gap-0.5 text-slate-500 text-xs"><Minus className="w-3.5 h-3.5" />Estável</span>;
}

/* Mini Bar Chart for monthly evolution */
function MiniBarChart({ months }: { months: MonthStats[] }) {
    const last12 = months.slice(-12);
    if (last12.length === 0) return <div className="text-slate-500 text-sm text-center py-8">Sem dados suficientes</div>;
    const max = Math.max(...last12.map(m => m.custoKmMedio), 0.01);

    return (
        <div className="flex items-end gap-1.5 h-32 w-full">
            {last12.map(m => {
                const height = Math.max(4, (m.custoKmMedio / max) * 100);
                const color = m.tendencia === 'up' ? 'from-red-500/80 to-rose-400/80' :
                    m.tendencia === 'down' ? 'from-emerald-500/80 to-green-400/80' :
                        'from-blue-500/80 to-indigo-400/80';
                return (
                    <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="relative w-full flex flex-col items-center justify-end" style={{ height: '100px' }}>
                            <div
                                className={`w-full rounded-t bg-gradient-to-t ${color} transition-all duration-500 hover:brightness-125`}
                                style={{ height: `${height}%` }}
                                title={`${m.label}: ${fmt(m.custoKmMedio, 3)} €/km`}
                            />
                        </div>
                        <span className="text-[9px] text-slate-500 group-hover:text-slate-300 transition-colors">{m.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
type TabType = 'viaturas' | 'motoristas' | 'mensal';

export default function EficienciaFrota() {
    const { fuelTransactions, viaturas, motoristas } = useWorkshop();
    const [activeTab, setActiveTab] = useState<TabType>('viaturas');
    const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
    const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

    // Build all analytics
    const segments = useMemo(() => buildSegments(fuelTransactions, viaturas, motoristas), [fuelTransactions]);
    const vehicleStats = useMemo(() => calcVehicleStats(segments, viaturas), [segments, viaturas]);
    const driverStats = useMemo(() => calcDriverStats(segments, motoristas), [segments, motoristas]);
    const monthStats = useMemo(() => calcMonthStats(segments), [segments]);

    // Fleet summary
    const totalKm = vehicleStats.reduce((a, v) => a + v.kmTotal, 0);
    const totalLitros = vehicleStats.reduce((a, v) => a + v.litrosTotal, 0);
    const totalCusto = vehicleStats.reduce((a, v) => a + v.custoTotal, 0);
    const globalConsumoMedio = totalKm > 0 ? (totalLitros / totalKm) * 100 : 0;
    const globalCustoKm = totalKm > 0 ? totalCusto / totalKm : 0;
    const anomalousCount = segments.filter(s => s.isAnormal).length;
    const criticalVehicles = vehicleStats.filter(v => v.alerta !== 'normal').length;

    const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
        { id: 'viaturas', label: 'Por Viatura', icon: Car },
        { id: 'motoristas', label: 'Por Motorista', icon: Users },
        { id: 'mensal', label: 'Evolução Mensal', icon: Calendar },
    ];

    const latestMonth = monthStats[monthStats.length - 1];
    const prevMonth = monthStats[monthStats.length - 2];
    const monthTrend = latestMonth && prevMonth
        ? ((latestMonth.custoKmMedio - prevMonth.custoKmMedio) / prevMonth.custoKmMedio) * 100
        : 0;

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-6 space-y-6">

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/20">
                            <Gauge className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Eficiência da Frota</h1>
                            <p className="text-slate-400 text-sm">Custo operacional por quilómetro · Análise automática</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    <span>{segments.length} segmentos analisados de {fuelTransactions.filter(t => t.status === 'confirmed' || t.isExternal).length} abastecimentos</span>
                </div>
            </div>

            {/* ── FLEET KPI CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    {
                        label: 'KM Totais', value: `${(totalKm).toLocaleString('pt-PT')} km`,
                        icon: Car, color: 'from-blue-600/20 to-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400'
                    },
                    {
                        label: 'Litros Consumidos', value: `${totalLitros.toFixed(0)} L`,
                        icon: Fuel, color: 'from-amber-600/20 to-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400'
                    },
                    {
                        label: 'Custo Total', value: fmtEur(totalCusto),
                        icon: DollarSign, color: 'from-emerald-600/20 to-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400'
                    },
                    {
                        label: 'Consumo Médio', value: `${fmt(globalConsumoMedio)} L/100km`,
                        icon: Gauge, color: 'from-purple-600/20 to-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400'
                    },
                    {
                        label: 'Custo/km Médio', value: `${fmt(globalCustoKm, 3)} €/km`,
                        icon: BarChart3, color: 'from-cyan-600/20 to-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400'
                    },
                    {
                        label: 'Alertas Activos', value: `${criticalVehicles} viaturas`,
                        detail: `${anomalousCount} abastecimentos anormais`,
                        icon: AlertTriangle, color: 'from-red-600/20 to-red-500/10', border: 'border-red-500/20', text: criticalVehicles > 0 ? 'text-red-400' : 'text-slate-500'
                    },
                ].map(kpi => (
                    <div key={kpi.label} className={`bg-gradient-to-br ${kpi.color} border ${kpi.border} rounded-xl p-4 backdrop-blur-sm hover:brightness-110 transition-all duration-200`}>
                        <div className="flex items-center justify-between mb-2">
                            <kpi.icon className={`w-4 h-4 ${kpi.text}`} />
                        </div>
                        <p className={`text-lg font-black ${kpi.text} leading-tight`}>{kpi.value}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5 font-medium">{kpi.label}</p>
                        {kpi.detail && <p className="text-slate-600 text-[9px] mt-0.5">{kpi.detail}</p>}
                    </div>
                ))}
            </div>

            {/* ── ANOMALY BANNER ── */}
            {anomalousCount > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-amber-300 font-bold text-sm">Anomalias Detectadas Automaticamente</p>
                        <p className="text-amber-400/70 text-xs mt-0.5">
                            {anomalousCount} abastecimento{anomalousCount !== 1 ? 's' : ''} com consumo {">"} 15% acima da média da viatura.
                            Verifique os registos assinalados com ⚠ na tabela por viatura.
                        </p>
                    </div>
                </div>
            )}

            {/* ── TABS ── */}
            <div className="flex items-center gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800/60 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── TAB: VIATURAS ── */}
            {activeTab === 'viaturas' && (
                <div className="space-y-3">
                    {vehicleStats.length === 0 ? (
                        <EmptyState message="Sem dados de abastecimento suficientes para calcular eficiência. São necessários pelo menos 2 abastecimentos por viatura com KM registados." />
                    ) : (
                        vehicleStats.map(v => (
                            <div key={v.vehicleId} className={`bg-slate-900/60 border rounded-xl overflow-hidden transition-all duration-300 hover:border-slate-600/60
                                ${v.alerta === 'critico' ? 'border-red-500/40' : v.alerta === 'alto' ? 'border-amber-500/30' : 'border-slate-800/60'}`}>

                                {/* Vehicle Row */}
                                <button
                                    className="w-full flex items-center gap-4 p-4 hover:bg-white/2 transition-colors text-left"
                                    onClick={() => setExpandedVehicle(expandedVehicle === v.vehicleId ? null : v.vehicleId)}
                                >
                                    {/* Score */}
                                    <ScoreBadge score={v.score} />

                                    {/* Vehicle Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-white text-base">{v.matricula}</span>
                                            <span className="text-slate-400 text-xs">{v.marca} {v.modelo}</span>
                                            <AlertBadge level={v.alerta} />
                                        </div>
                                        <div className="flex items-center flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                            <span className="text-slate-400 text-xs">{v.kmTotal.toLocaleString('pt-PT')} km</span>
                                            <span className="text-slate-400 text-xs">{fmt(v.litrosTotal)} L</span>
                                            <span className="text-slate-400 text-xs">{fmtEur(v.custoTotal)}</span>
                                        </div>
                                    </div>

                                    {/* Key metrics */}
                                    <div className="hidden md:flex items-center gap-6">
                                        <div className="text-center">
                                            <p className={`text-lg font-black ${v.alerta === 'critico' ? 'text-red-400' : v.alerta === 'alto' ? 'text-amber-400' : 'text-white'}`}>
                                                {fmt(v.consumoMedio)} L
                                            </p>
                                            <p className="text-slate-500 text-[10px]">L/100km</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black text-cyan-400">{fmt(v.custoKmMedio, 3)} €</p>
                                            <p className="text-slate-500 text-[10px]">€/km</p>
                                        </div>
                                        <div className="text-center">
                                            <TrendIcon dir={v.tendencia} />
                                            <p className="text-slate-500 text-[10px]">Tendência</p>
                                        </div>
                                    </div>

                                    {/* Expand icon */}
                                    <div className="text-slate-500">
                                        {expandedVehicle === v.vehicleId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </button>

                                {/* Mobile metrics */}
                                <div className="md:hidden flex items-center gap-4 px-4 pb-3">
                                    <div className="text-center flex-1">
                                        <p className={`text-sm font-black ${v.alerta !== 'normal' ? 'text-amber-400' : 'text-white'}`}>{fmt(v.consumoMedio)} L</p>
                                        <p className="text-slate-500 text-[10px]">L/100km</p>
                                    </div>
                                    <div className="text-center flex-1">
                                        <p className="text-sm font-black text-cyan-400">{fmt(v.custoKmMedio, 3)} €</p>
                                        <p className="text-slate-500 text-[10px]">€/km</p>
                                    </div>
                                    <div className="text-center flex-1">
                                        <TrendIcon dir={v.tendencia} />
                                        <p className="text-slate-500 text-[10px]">Tendência</p>
                                    </div>
                                </div>

                                {/* Expanded: Segments table */}
                                {expandedVehicle === v.vehicleId && (
                                    <div className="border-t border-slate-800/60 bg-slate-950/40 p-4">
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Histórico de Abastecimentos ({v.segmentos.length})</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-slate-500 text-left border-b border-slate-800/60">
                                                        <th className="pb-2 pr-4 font-semibold">Data</th>
                                                        <th className="pb-2 pr-4 font-semibold">KM Percorridos</th>
                                                        <th className="pb-2 pr-4 font-semibold">Litros</th>
                                                        <th className="pb-2 pr-4 font-semibold">Consumo</th>
                                                        <th className="pb-2 pr-4 font-semibold">Custo</th>
                                                        <th className="pb-2 pr-4 font-semibold">€/km</th>
                                                        <th className="pb-2 font-semibold">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {v.segmentos.slice(-20).reverse().map(s => (
                                                        <tr key={s.transactionId} className={`border-b border-slate-900/60 hover:bg-white/2 transition-colors ${s.isAnormal ? 'bg-amber-500/5' : ''}`}>
                                                            <td className="py-2 pr-4 text-slate-300">{new Date(s.timestamp).toLocaleDateString('pt-PT')}</td>
                                                            <td className="py-2 pr-4 text-slate-300">{s.kmPercorridos.toLocaleString('pt-PT')} km</td>
                                                            <td className="py-2 pr-4 text-slate-300">{fmt(s.liters)} L</td>
                                                            <td className={`py-2 pr-4 font-bold ${s.isAnormal ? 'text-amber-400' : 'text-white'}`}>
                                                                {s.isAnormal && '⚠ '}{fmt(s.consumo)} L/100km
                                                            </td>
                                                            <td className="py-2 pr-4 text-slate-300">{fmtEur(s.custo)}</td>
                                                            <td className="py-2 pr-4 text-cyan-400 font-bold">{fmt(s.custoKm, 3)} €</td>
                                                            <td className="py-2">
                                                                {s.isAnormal
                                                                    ? <span className="text-amber-400 text-[10px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">Anormal</span>
                                                                    : <span className="text-emerald-400 text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Normal</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── TAB: MOTORISTAS ── */}
            {activeTab === 'motoristas' && (
                <div className="space-y-3">
                    {driverStats.length === 0 ? (
                        <EmptyState message="Sem dados de motoristas nos abastecimentos. Verifique se os abastecimentos têm motoristas associados." />
                    ) : (
                        driverStats.map((d, idx) => (
                            <div key={d.driverId} className={`bg-slate-900/60 border rounded-xl overflow-hidden transition-all hover:border-slate-600/60
                                ${d.alerta === 'critico' ? 'border-red-500/40' : d.alerta === 'alto' ? 'border-amber-500/30' : 'border-slate-800/60'}`}>
                                <button
                                    className="w-full flex items-center gap-4 p-4 hover:bg-white/2 transition-colors text-left"
                                    onClick={() => setExpandedDriver(expandedDriver === d.driverId ? null : d.driverId)}
                                >
                                    {/* Rank badge */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0
                                        ${idx === 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            idx === driverStats.length - 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                        {idx === driverStats.length - 1 ? <Award className="w-5 h-5" /> : idx + 1}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-white">{d.nome}</span>
                                            <AlertBadge level={d.alerta} />
                                        </div>
                                        <p className="text-slate-500 text-xs mt-0.5">
                                            {d.abastecimentos} abastecimentos · {d.veiculosUsados.length} viatura{d.veiculosUsados.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>

                                    <div className="hidden md:flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-slate-300 text-sm font-bold">{d.kmConduzidos.toLocaleString('pt-PT')} km</p>
                                            <p className="text-slate-500 text-[10px]">KM conduzidos</p>
                                        </div>
                                        <div className="text-center">
                                            <p className={`text-sm font-black ${d.alerta !== 'normal' ? 'text-amber-400' : 'text-white'}`}>{fmt(d.consumoMedio)} L</p>
                                            <p className="text-slate-500 text-[10px]">L/100km</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-black text-cyan-400">{fmt(d.custoKmMedio, 3)} €</p>
                                            <p className="text-slate-500 text-[10px]">€/km médio</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-black text-white">{fmtEur(d.custoTotal)}</p>
                                            <p className="text-slate-500 text-[10px]">Custo Total</p>
                                        </div>
                                    </div>

                                    <div className="text-slate-500">
                                        {expandedDriver === d.driverId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </button>

                                {/* Mobile */}
                                <div className="md:hidden grid grid-cols-3 gap-2 px-4 pb-3">
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-white">{d.kmConduzidos.toLocaleString('pt-PT')}</p>
                                        <p className="text-slate-500 text-[10px]">km</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`text-xs font-bold ${d.alerta !== 'normal' ? 'text-amber-400' : 'text-white'}`}>{fmt(d.consumoMedio)}</p>
                                        <p className="text-slate-500 text-[10px]">L/100km</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-cyan-400">{fmt(d.custoKmMedio, 3)} €</p>
                                        <p className="text-slate-500 text-[10px]">€/km</p>
                                    </div>
                                </div>

                                {/* Expanded: consumption bar */}
                                {expandedDriver === d.driverId && (
                                    <div className="border-t border-slate-800/60 bg-slate-950/40 p-4 space-y-3">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { label: 'KM Conduzidos', value: `${d.kmConduzidos.toLocaleString('pt-PT')} km` },
                                                { label: 'Consumo Médio', value: `${fmt(d.consumoMedio)} L/100km` },
                                                { label: 'Custo Total', value: fmtEur(d.custoTotal) },
                                                { label: '€/km Médio', value: `${fmt(d.custoKmMedio, 3)} €/km` },
                                            ].map(item => (
                                                <div key={item.label} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60">
                                                    <p className="text-white font-bold">{item.value}</p>
                                                    <p className="text-slate-500 text-xs">{item.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Viaturas utilizadas</p>
                                            <div className="flex flex-wrap gap-2">
                                                {d.veiculosUsados.map(vid => (
                                                    <span key={vid} className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg">{vid}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── TAB: MENSAL ── */}
            {activeTab === 'mensal' && (
                <div className="space-y-4">
                    {/* Month summary cards */}
                    {latestMonth && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                {
                                    label: 'Custo/km Este Mês', icon: BarChart3,
                                    value: `${fmt(latestMonth.custoKmMedio, 3)} €/km`,
                                    detail: prevMonth ? `${monthTrend > 0 ? '+' : ''}${fmtPct(monthTrend)} vs mês anterior` : 'Primeiro mês',
                                    color: monthTrend > 3 ? 'text-red-400' : monthTrend < -3 ? 'text-emerald-400' : 'text-cyan-400'
                                },
                                {
                                    label: 'Litros Este Mês', icon: Fuel,
                                    value: `${fmt(latestMonth.litrosTotal)} L`,
                                    detail: `${latestMonth.abastecimentos} abastecimentos`,
                                    color: 'text-amber-400'
                                },
                                {
                                    label: 'Custo Este Mês', icon: DollarSign,
                                    value: fmtEur(latestMonth.custoTotal),
                                    detail: `${latestMonth.kmTotal.toLocaleString('pt-PT')} km`,
                                    color: 'text-emerald-400'
                                },
                                {
                                    label: 'Tendência', icon: monthTrend > 3 ? TrendingUp : monthTrend < -3 ? TrendingDown : Activity,
                                    value: monthTrend > 3 ? 'A subir ↑' : monthTrend < -3 ? 'A descer ↓' : 'Estável →',
                                    detail: prevMonth ? `${prevMonth.label}: ${fmt(prevMonth.custoKmMedio, 3)} €/km` : '-',
                                    color: monthTrend > 3 ? 'text-red-400' : monthTrend < -3 ? 'text-emerald-400' : 'text-slate-400'
                                },
                            ].map(card => (
                                <div key={card.label} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <card.icon className={`w-4 h-4 ${card.color}`} />
                                        <p className="text-slate-500 text-xs">{card.label}</p>
                                    </div>
                                    <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
                                    <p className="text-slate-500 text-[10px] mt-1">{card.detail}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bar chart */}
                    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-white font-bold">Evolução Custo/km da Frota</p>
                                <p className="text-slate-500 text-xs">€/km médio por mês · últimos 12 meses</p>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />A descer</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />A subir</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Estável</span>
                            </div>
                        </div>
                        <MiniBarChart months={monthStats} />
                    </div>

                    {/* Monthly table */}
                    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800/60">
                            <p className="text-white font-bold text-sm">Detalhe Mensal</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-500 bg-slate-950/40 text-left">
                                        {['Mês', 'KM Total', 'Litros', 'Custo Total', '€/km Médio', 'Abastecimentos', 'Tendência'].map(h => (
                                            <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...monthStats].reverse().map(m => (
                                        <tr key={m.mes} className="border-t border-slate-800/40 hover:bg-white/2 transition-colors">
                                            <td className="px-4 py-3 text-white font-bold">{m.label.toUpperCase()}</td>
                                            <td className="px-4 py-3 text-slate-300">{m.kmTotal.toLocaleString('pt-PT')} km</td>
                                            <td className="px-4 py-3 text-slate-300">{fmt(m.litrosTotal)} L</td>
                                            <td className="px-4 py-3 text-emerald-400 font-bold">{fmtEur(m.custoTotal)}</td>
                                            <td className="px-4 py-3 text-cyan-400 font-black">{fmt(m.custoKmMedio, 3)} €/km</td>
                                            <td className="px-4 py-3 text-slate-300">{m.abastecimentos}</td>
                                            <td className="px-4 py-3"><TrendIcon dir={m.tendencia} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── FOOTER INFO ── */}
            <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-900/30 rounded-lg p-3 border border-slate-800/40">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>Os cálculos são baseados nos abastecimentos confirmados e importados BP registados no sistema. O Score de Eficiência varia entre 0 (muito ineficiente) e 100 (excelente). Abastecimentos sem KM registados não são incluídos nos cálculos de consumo.</p>
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-slate-800/60 border border-slate-700/60 mb-4">
                <Gauge className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 font-semibold mb-2">Sem dados disponíveis</p>
            <p className="text-slate-600 text-sm max-w-md">{message}</p>
        </div>
    );
}
