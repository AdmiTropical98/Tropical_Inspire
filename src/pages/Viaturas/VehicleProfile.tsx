import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Car, Fuel, Wrench, ClipboardList, Gauge, CalendarClock, AlertTriangle, BarChart2, History, DollarSign, ShieldCheck } from 'lucide-react';
import VehicleCostsTab from './VehicleCostsTab';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    LineChart,
    Line,
    AreaChart,
    Area
} from 'recharts';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { supabase } from '../../lib/supabase';
import type {
    Requisicao,
    FuelTransaction,
    Manutencao,
    VehicleInsurancePolicy,
    VehicleInspection,
    VehicleIucRecord,
    VehicleOtherCost,
    VehicleCostHistoryRow,
    VehicleFinancialSummary,
    VehicleComplianceAlert
} from '../../types';

const normalizePlate = (value?: string | null) => (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const isLikelyUUID = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const formatDateTime = (value?: string | null) => {
    if (!value) return { date: '-', time: '--:--' };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { date: '-', time: '--:--' };
    return {
        date: parsed.toLocaleDateString('pt-PT'),
        time: parsed.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    };
};

interface VehicleProfileSummaryRow {
    vehicle_id: string;
    total_fuel_cost: number;
    total_maintenance_cost: number;
    total_cost: number;
    total_requisitions: number;
    total_refuels: number;
    total_liters: number;
    km_travelled: number;
    average_consumption: number;
    cost_per_km: number;
    current_km: number;
}

export default function VehicleProfile() {
    const navigate = useNavigate();
    const { viaturaId } = useParams();
    const { viaturas, requisicoes, fuelTransactions, motoristas } = useWorkshop();
    const [maintenanceRecords, setMaintenanceRecords] = useState<Manutencao[]>([]);
    const [summarySql, setSummarySql] = useState<VehicleProfileSummaryRow | null>(null);
    const [monthlyFuelSql, setMonthlyFuelSql] = useState<Array<{ month: string; cost: number; liters: number }>>([]);
    const [monthlyMaintenanceSql, setMonthlyMaintenanceSql] = useState<Array<{ month: string; cost: number }>>([]);
    const [consumptionSql, setConsumptionSql] = useState<Array<{ month: string; average_consumption: number }>>([]);
    const [financialSummarySql, setFinancialSummarySql] = useState<VehicleFinancialSummary | null>(null);
    const [costHistorySql, setCostHistorySql] = useState<VehicleCostHistoryRow[]>([]);
    const [complianceAlertsSql, setComplianceAlertsSql] = useState<VehicleComplianceAlert[]>([]);
    const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'all' | VehicleCostHistoryRow['category']>('all');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [historyYearFilter, setHistoryYearFilter] = useState('all');
    const [profileTab, setProfileTab] = useState<'overview' | 'costs' | 'history' | 'analysis'>('overview');
    const [insurancePolicies, setInsurancePolicies] = useState<VehicleInsurancePolicy[]>([]);
    const [inspectionRecords, setInspectionRecords] = useState<VehicleInspection[]>([]);
    const [iucRecords, setIucRecords] = useState<VehicleIucRecord[]>([]);
    const [otherCosts, setOtherCosts] = useState<VehicleOtherCost[]>([]);

    const viatura = viaturas.find(v => v.id === viaturaId);

    const loadVehicleProfileAggregates = async () => {
            if (!viaturaId || !viatura) {
                setSummarySql(null);
                setMonthlyFuelSql([]);
                setMonthlyMaintenanceSql([]);
                setConsumptionSql([]);
                setMaintenanceRecords([]);
                setFinancialSummarySql(null);
                setCostHistorySql([]);
                setComplianceAlertsSql([]);
                setInsurancePolicies([]);
                setInspectionRecords([]);
                setIucRecords([]);
                setOtherCosts([]);
                return;
            }

            const plate = normalizePlate(viatura.matricula);

            const [
                summaryResult,
                monthlyFuelResult,
                monthlyMaintenanceResult,
                consumptionResult,
                maintenanceResult,
                financialSummaryResult,
                costHistoryResult,
                complianceResult,
                insuranceResult,
                inspectionsResult,
                iucResult,
                otherCostsResult
            ] = await Promise.all([
                supabase
                    .from('vehicle_profile_summary')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .maybeSingle(),
                supabase
                    .from('vehicle_fuel_monthly_summary')
                    .select('month,cost,liters')
                    .eq('vehicle_id', viaturaId)
                    .order('month', { ascending: true }),
                supabase
                    .from('vehicle_maintenance_monthly_summary')
                    .select('month,cost')
                    .eq('vehicle_id', viaturaId)
                    .order('month', { ascending: true }),
                supabase
                    .from('vehicle_consumption_monthly_summary')
                    .select('month,average_consumption')
                    .eq('vehicle_id', viaturaId)
                    .order('month', { ascending: true }),
                supabase
                    .from('manutencoes')
                    .select('id,data,tipo,km,oficina,custo,descricao,pdf_url,vehicle_id,license_plate,matricula')
                    .or(`vehicle_id.eq.${viaturaId},license_plate.eq.${plate},matricula.eq.${plate}`)
                    .order('data', { ascending: false }),
                supabase
                    .from('vehicle_financial_summary')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .maybeSingle(),
                supabase
                    .from('vehicle_cost_history')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .order('event_date', { ascending: false })
                    .limit(1500),
                supabase
                    .from('vehicle_compliance_alerts')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .order('severity', { ascending: false }),
                supabase
                    .from('vehicle_insurance_policies')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .order('end_date', { ascending: true }),
                supabase
                    .from('vehicle_inspections')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .order('inspection_date', { ascending: false }),
                supabase
                    .from('vehicle_iuc_records')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .order('fiscal_year', { ascending: false }),
                supabase
                    .from('vehicle_other_costs')
                    .select('*')
                    .eq('vehicle_id', viaturaId)
                    .order('cost_date', { ascending: false })
            ]);

            if (!summaryResult.error) setSummarySql(summaryResult.data as VehicleProfileSummaryRow | null);
            if (!monthlyFuelResult.error) setMonthlyFuelSql((monthlyFuelResult.data || []).map(row => ({ month: row.month, cost: Number(row.cost || 0), liters: Number(row.liters || 0) })));
            if (!monthlyMaintenanceResult.error) setMonthlyMaintenanceSql((monthlyMaintenanceResult.data || []).map(row => ({ month: row.month, cost: Number(row.cost || 0) })));
            if (!consumptionResult.error) setConsumptionSql((consumptionResult.data || []).map(row => ({ month: row.month, average_consumption: Number(row.average_consumption || 0) })));
            if (!financialSummaryResult.error) setFinancialSummarySql(financialSummaryResult.data as VehicleFinancialSummary | null);
            if (!costHistoryResult.error) {
                setCostHistorySql((costHistoryResult.data || []).map((row: any) => ({
                    ...row,
                    amount: Number(row.amount || 0)
                })));
            }
            if (!complianceResult.error) setComplianceAlertsSql((complianceResult.data || []) as VehicleComplianceAlert[]);

            if (!maintenanceResult.error) {
                setMaintenanceRecords((maintenanceResult.data || []).map((item: any) => ({
                    id: item.id,
                    data: item.data,
                    tipo: item.tipo || 'outros',
                    km: Number(item.km || 0),
                    oficina: item.oficina || '—',
                    custo: Number(item.custo || 0),
                    descricao: item.descricao || '',
                    pdfUrl: item.pdf_url || undefined
                })));
            }

            if (!insuranceResult.error) setInsurancePolicies((insuranceResult.data || []) as VehicleInsurancePolicy[]);
            if (!inspectionsResult.error) setInspectionRecords((inspectionsResult.data || []) as VehicleInspection[]);
            if (!iucResult.error) setIucRecords((iucResult.data || []) as VehicleIucRecord[]);
            if (!otherCostsResult.error) setOtherCosts((otherCostsResult.data || []) as VehicleOtherCost[]);
    };

    useEffect(() => {
        void loadVehicleProfileAggregates();
    }, [viaturaId, viatura]);

    const resolveVehicleRef = useMemo(() => {
        const byPlate = new Map<string, string>();
        viaturas.forEach(v => byPlate.set(normalizePlate(v.matricula), v.id));

        return (value?: string | null) => {
            if (!value) return undefined;
            if (isLikelyUUID(value) && viaturas.some(v => v.id === value)) return value;
            return byPlate.get(normalizePlate(value));
        };
    }, [viaturas]);

    const requisitionVehicleId = (req: Requisicao) => {
        const raw = req as Requisicao & Record<string, any>;
        return req.viaturaId
            || resolveVehicleRef(raw.viatura_id)
            || resolveVehicleRef(raw.vehicle_id)
            || resolveVehicleRef(raw.matricula)
            || resolveVehicleRef(raw.license_plate);
    };

    const fuelVehicleId = (tx: FuelTransaction) => {
        const raw = tx as FuelTransaction & Record<string, any>;
        return tx.vehicleId
            ? (resolveVehicleRef(tx.vehicleId) || tx.vehicleId)
            : resolveVehicleRef(raw.vehicle_id || raw.license_plate || raw.matricula);
    };

    const vehicleRequisitions = useMemo(() => {
        if (!viatura) return [];
        return requisicoes
            .filter(req => requisitionVehicleId(req) === viatura.id)
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }, [requisicoes, viatura]);

    const vehicleFuelTransactions = useMemo(() => {
        if (!viatura) return [];
        return fuelTransactions
            .filter(tx => fuelVehicleId(tx) === viatura.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [fuelTransactions, viatura]);

    const maintenanceHistory = useMemo(() => {
        const fromVehicle = viatura?.manutencoes || [];
        const merged = [...fromVehicle, ...maintenanceRecords];
        const unique = new Map<string, Manutencao>();
        merged.forEach(item => {
            const key = item.id || `${item.data}-${item.km}-${item.custo}`;
            if (!unique.has(key)) unique.set(key, item);
        });
        return [...unique.values()].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }, [viatura, maintenanceRecords]);

    const requisitionCost = (req: Requisicao) => {
        if (typeof req.custo === 'number') return req.custo;
        return (req.itens || []).reduce((acc, item) => {
            if (typeof item.valor_total === 'number') return acc + item.valor_total;
            if (typeof item.valor_unitario === 'number') return acc + (item.valor_unitario * (item.quantidade || 0));
            return acc;
        }, 0);
    };

    const fuelByDateAsc = [...vehicleFuelTransactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const consumptionSeries = fuelByDateAsc.map((tx, index) => {
        if (index === 0) return { date: tx.timestamp, consumo: null as number | null, txId: tx.id };
        const previous = fuelByDateAsc[index - 1];
        const kmDelta = Number(tx.km || 0) - Number(previous.km || 0);
        if (kmDelta <= 0) return { date: tx.timestamp, consumo: null as number | null, txId: tx.id };
        return {
            date: tx.timestamp,
            consumo: Number((((tx.liters || 0) / kmDelta) * 100).toFixed(2)),
            txId: tx.id
        };
    });

    const validConsumption = consumptionSeries.filter(row => typeof row.consumo === 'number').map(row => row.consumo as number);
    const averageConsumptionBase = validConsumption.length ? validConsumption.reduce((a, b) => a + b, 0) / validConsumption.length : 0;

    const totalFuelCostBase = vehicleFuelTransactions.reduce((acc, tx) => acc + Number(tx.totalCost || tx.total_cost || 0), 0);
    const totalLitersBase = vehicleFuelTransactions.reduce((acc, tx) => acc + Number(tx.liters || 0), 0);
    const maintenanceFromHistory = maintenanceHistory.reduce((acc, item) => acc + Number(item.custo || 0), 0);
    const maintenanceFromRequisitions = vehicleRequisitions.reduce((acc, req) => acc + requisitionCost(req), 0);
    const totalMaintenanceCostBase = maintenanceFromHistory + maintenanceFromRequisitions;
    const totalGeneralCostBase = totalFuelCostBase + totalMaintenanceCostBase;

    const kmValues = fuelByDateAsc.map(t => Number(t.km || 0)).filter(v => Number.isFinite(v) && v > 0);
    const kmFromMaintenance = maintenanceHistory.map(m => Number(m.km || 0)).filter(v => Number.isFinite(v) && v > 0);
    const allKm = [...kmValues, ...kmFromMaintenance];
    const currentKmBase = allKm.length ? Math.max(...allKm) : 0;
    const kmTravelledBase = kmValues.length > 1 ? Math.max(...kmValues) - Math.min(...kmValues) : 0;
    const costPerKmBase = kmTravelledBase > 0 ? totalGeneralCostBase / kmTravelledBase : 0;

    const vehicleStatus = viatura?.estado === 'em_manutencao'
        ? 'Manutenção'
        : ((viatura?.obs || '').toLowerCase().includes('avaria') || (viatura?.obs || '').toLowerCase().includes('oficina')
            ? 'Manutenção'
            : 'Operacional');

    const monthlyFuelFallback = Object.values(vehicleFuelTransactions.reduce((acc, tx) => {
        const key = new Date(tx.timestamp).toISOString().slice(0, 7);
        if (!acc[key]) acc[key] = { month: key, cost: 0, liters: 0 };
        acc[key].cost += Number(tx.totalCost || tx.total_cost || 0);
        acc[key].liters += Number(tx.liters || 0);
        return acc;
    }, {} as Record<string, { month: string; cost: number; liters: number }>)).sort((a, b) => a.month.localeCompare(b.month));

    const monthlyMaintenanceFallback = Object.values([
        ...maintenanceHistory.map(item => ({ date: item.data, value: Number(item.custo || 0) })),
        ...vehicleRequisitions.map(req => ({ date: req.data, value: requisitionCost(req) }))
    ].reduce((acc, entry) => {
        const key = new Date(entry.date).toISOString().slice(0, 7);
        if (!acc[key]) acc[key] = { month: key, cost: 0 };
        acc[key].cost += entry.value;
        return acc;
    }, {} as Record<string, { month: string; cost: number }>)).sort((a, b) => a.month.localeCompare(b.month));

    const monthlyFuel = monthlyFuelSql.length ? monthlyFuelSql : monthlyFuelFallback;
    const monthlyMaintenance = monthlyMaintenanceSql.length ? monthlyMaintenanceSql : monthlyMaintenanceFallback;

    const averageConsumption = summarySql?.average_consumption ?? averageConsumptionBase;
    const totalFuelCost = financialSummarySql?.total_fuel_cost ?? summarySql?.total_fuel_cost ?? totalFuelCostBase;
    const totalLiters = summarySql?.total_liters ?? totalLitersBase;
    const totalMaintenanceCost = financialSummarySql?.total_maintenance_cost ?? summarySql?.total_maintenance_cost ?? totalMaintenanceCostBase;
    const totalInsuranceCost = financialSummarySql?.total_insurance_cost ?? insurancePolicies.reduce((acc, item) => acc + Number(item.premium_amount || 0), 0);
    const totalIucCost = financialSummarySql?.total_iuc_cost ?? iucRecords.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const totalTollsCost = financialSummarySql?.total_tolls_cost ?? costHistorySql.filter(item => item.category === 'portagens').reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const totalOtherCosts = financialSummarySql?.total_other_costs ?? otherCosts.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const totalInspectionCost = financialSummarySql?.total_inspection_cost ?? inspectionRecords.reduce((acc, item) => acc + Number(item.cost || 0), 0);
    const totalGeneralCost = financialSummarySql?.total_vehicle_cost ?? summarySql?.total_cost ?? totalGeneralCostBase;
    const currentKm = summarySql?.current_km ?? currentKmBase;
    const kmTravelled = summarySql?.km_travelled ?? kmTravelledBase;
    const costPerKm = financialSummarySql?.cost_per_km ?? summarySql?.cost_per_km ?? costPerKmBase;
    const totalRequisitionsCount = summarySql?.total_requisitions ?? vehicleRequisitions.length;
    const totalRefuelsCount = summarySql?.total_refuels ?? vehicleFuelTransactions.length;
    const pendingReq = vehicleRequisitions.filter(r => (r.status || 'pendente') !== 'concluida').length;

    const lastFuelDate = vehicleFuelTransactions[0]?.timestamp;
    const daysWithoutFuelRecord = lastFuelDate ? Math.floor((Date.now() - new Date(lastFuelDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
    const lastMaintenance = maintenanceHistory[0];
    const kmSinceMaintenance = lastMaintenance ? Math.max(currentKm - Number(lastMaintenance.km || 0), 0) : currentKm;
    const maintenanceDays = lastMaintenance ? Math.floor((Date.now() - new Date(lastMaintenance.data).getTime()) / (1000 * 60 * 60 * 24)) : null;

    const consumptionNumbers = consumptionSeries.map(c => c.consumo).filter((v): v is number => typeof v === 'number');
    const lastConsumption = consumptionNumbers.length ? consumptionNumbers[consumptionNumbers.length - 1] : null;
    const historicAverage = consumptionNumbers.length > 1
        ? consumptionNumbers.slice(0, -1).reduce((acc, value) => acc + value, 0) / (consumptionNumbers.length - 1)
        : averageConsumption;

    const profileAlerts = [
        pendingReq > 0
            ? { id: 'pending-req', title: 'Requisições pendentes', description: `${pendingReq} requisição(ões) por fechar` }
            : null,
        (lastConsumption !== null && historicAverage > 0 && lastConsumption > historicAverage * 1.2)
            ? { id: 'abnormal-consumption', title: 'Consumo anormal', description: `${lastConsumption.toFixed(2)} L/100km (>20% acima da média)` }
            : null,
        (kmSinceMaintenance >= 10000)
            ? { id: 'km-review', title: 'Revisão por km', description: `${kmSinceMaintenance.toLocaleString('pt-PT')} km desde a última manutenção` }
            : null,
        (maintenanceDays !== null && maintenanceDays >= 365)
            ? { id: 'annual-review', title: 'Revisão anual', description: `${maintenanceDays} dias desde a última manutenção` }
            : null,
        (daysWithoutFuelRecord !== null && daysWithoutFuelRecord >= 30)
            ? { id: 'km-no-record', title: 'Km sem registo recente', description: `${daysWithoutFuelRecord} dias sem abastecimento registado` }
            : null
    ].filter(Boolean) as Array<{ id: string; title: string; description: string }>;

    const sqlAlerts = complianceAlertsSql.map(alert => ({
        id: `sql-${alert.id}`,
        title: alert.title,
        description: alert.message
    }));

    const mergedAlerts = [...sqlAlerts, ...profileAlerts].filter((alert, index, arr) => arr.findIndex(item => item.title === alert.title && item.description === alert.description) === index);

    const historyYears = Array.from(new Set(costHistorySql.map(r => new Date(r.event_date).getFullYear().toString()))).sort().reverse();

    const filteredCostHistory = costHistorySql.filter(item => {
        if (historyCategoryFilter !== 'all' && item.category !== historyCategoryFilter) return false;
        const d = new Date(item.event_date);
        if (Number.isNaN(d.getTime())) return false;
        if (historyYearFilter !== 'all' && d.getFullYear().toString() !== historyYearFilter) return false;
        if (historyStartDate && d < new Date(`${historyStartDate}T00:00:00`)) return false;
        if (historyEndDate && d > new Date(`${historyEndDate}T23:59:59`)) return false;
        return true;
    });



    const timeline = useMemo(() => {
        if (!viatura) return [] as Array<{ id: string; date: string; type: 'fuel' | 'req' | 'maintenance' | 'alert'; title: string; subtitle: string }>;

        const events: Array<{ id: string; date: string; type: 'fuel' | 'req' | 'maintenance' | 'alert'; title: string; subtitle: string }> = [];

        vehicleFuelTransactions.forEach(tx => {
            events.push({
                id: `fuel-${tx.id}`,
                date: tx.timestamp,
                type: 'fuel',
                title: `Abastecimento • ${(tx.liters || 0).toFixed(2)}L`,
                subtitle: `${Number(tx.totalCost || tx.total_cost || 0).toFixed(2)}€ • ${(tx.km || 0)} km`
            });
        });

        vehicleRequisitions.forEach(req => {
            events.push({
                id: `req-${req.id}`,
                date: req.data,
                type: 'req',
                title: `Requisição #${req.numero}`,
                subtitle: `${requisitionCost(req).toFixed(2)}€ • ${req.status || 'pendente'}`
            });
        });

        maintenanceHistory.forEach(item => {
            events.push({
                id: `maintenance-${item.id}`,
                date: item.data,
                type: 'maintenance',
                title: `Manutenção ${item.tipo}`,
                subtitle: `${Number(item.custo || 0).toFixed(2)}€ • ${item.oficina}`
            });
        });

        events.push({
            id: `status-${viatura.id}`,
            date: new Date().toISOString(),
            type: 'maintenance',
            title: 'Alteração de estado',
            subtitle: `Estado atual: ${vehicleStatus}`
        });

        mergedAlerts.forEach(alert => {
            events.push({
                id: `alert-${alert.id}`,
                date: new Date().toISOString(),
                type: 'alert',
                title: alert.title,
                subtitle: alert.description
            });
        });

        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [viatura, vehicleFuelTransactions, vehicleRequisitions, maintenanceHistory, mergedAlerts, vehicleStatus]);

    if (!viatura) {
        return (
            <div className="space-y-6">
                <button
                    onClick={() => navigate('/viaturas')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 border border-slate-200 text-slate-300 rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar à Frota
                </button>
                <div className="bg-white/90 border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                    Viatura não encontrada.
                </div>
            </div>
        );
    }

    const statusColor = vehicleStatus === 'Operacional' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10';

    const PROFILE_TABS: { id: 'overview' | 'costs' | 'history' | 'analysis'; label: string; Icon: React.FC<any> }[] = [
        { id: 'overview', label: 'Visão Geral', Icon: Car },
        { id: 'costs', label: 'Custos da Viatura', Icon: DollarSign },
        { id: 'history', label: 'Histórico', Icon: History },
        { id: 'analysis', label: 'Análise', Icon: BarChart2 },
    ];

    return (
        <div className="space-y-6">
            {/* Back + header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/viaturas')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar à Frota
                </button>
            </div>

            {/* Vehicle card */}
            <div className="bg-white/90 border border-slate-200 rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="text-slate-400 text-sm">Perfil da Viatura</div>
                        <h1 className="text-3xl font-black text-slate-900 mt-1">{viatura.marca} {viatura.modelo}</h1>
                        <div className="mt-3 flex items-center gap-3 text-sm">
                            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono">{viatura.matricula}</span>
                            <span className="text-slate-400">Ano {viatura.ano || 'N/A'}</span>
                            <span className={`px-2 py-1 rounded border ${statusColor}`}>{vehicleStatus}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs uppercase tracking-wider text-slate-500">Quilometragem Atual</div>
                        <div className="text-2xl font-black text-slate-900">{currentKm.toLocaleString('pt-PT')} km</div>
                        <div className="text-sm text-slate-400 mt-0.5">{totalGeneralCost.toFixed(2)}€ custo total</div>
                    </div>
                </div>
            </div>

            {/* Main tab bar */}
            <div className="border-b border-slate-200">
                <div className="flex gap-1">
                    {PROFILE_TABS.map(({ id, label, Icon }) => {
                        const active = profileTab === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setProfileTab(id)}
                                className={`inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                                    active
                                        ? 'border-[#d59d31] text-[#1f2957] bg-amber-50/60'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {profileTab === 'overview' && (<>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                    { label: 'Total combustível', value: `${totalFuelCost.toFixed(2)}€`, icon: Fuel, color: 'text-blue-400' },
                    { label: 'Total manutenção', value: `${totalMaintenanceCost.toFixed(2)}€`, icon: Wrench, color: 'text-amber-400' },
                        { label: 'Total seguros', value: `${totalInsuranceCost.toFixed(2)}€`, icon: ShieldCheck, color: 'text-emerald-400' },
                        { label: 'Total IUC', value: `${totalIucCost.toFixed(2)}€`, icon: Receipt, color: 'text-rose-400' },
                        { label: 'Total portagens', value: `${totalTollsCost.toFixed(2)}€`, icon: Car, color: 'text-sky-400' },
                        { label: 'Total outros custos', value: `${totalOtherCosts.toFixed(2)}€`, icon: FileSearch, color: 'text-orange-400' },
                        { label: 'Total inspeções', value: `${totalInspectionCost.toFixed(2)}€`, icon: ClipboardList, color: 'text-lime-400' },
                        { label: 'Custo total da viatura', value: `${totalGeneralCost.toFixed(2)}€`, icon: ClipboardList, color: 'text-purple-400' },
                    { label: 'Custo por km', value: `${costPerKm.toFixed(3)}€/km`, icon: Gauge, color: 'text-violet-400' },
                    { label: 'Consumo médio', value: `${averageConsumption.toFixed(2)} L/100km`, icon: Gauge, color: 'text-emerald-400' },
                    { label: 'Km percorridos', value: `${kmTravelled.toLocaleString('pt-PT')} km`, icon: Car, color: 'text-indigo-400' },
                    { label: 'Nº requisições', value: String(totalRequisitionsCount), icon: ClipboardList, color: 'text-fuchsia-400' },
                    { label: 'Nº abastecimentos', value: String(totalRefuelsCount), icon: Fuel, color: 'text-cyan-400' }
                ].map(card => (
                    <div key={card.label} className="bg-white/90 border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs uppercase text-slate-500 font-bold tracking-wider">{card.label}</div>
                                <div className="text-xl font-black text-slate-900 mt-1">{card.value}</div>
                            </div>
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-[#1f2957] mb-4">Alertas Automáticos</h2>
                <div className="space-y-3">
                    {mergedAlerts.map(alert => (
                        <div key={alert.id} className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400" />
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
                                <div className="text-xs text-slate-400">{alert.description}</div>
                            </div>
                        </div>
                    ))}
                    {mergedAlerts.length === 0 && <p className="text-slate-500 text-sm">Sem alertas ativos para esta viatura.</p>}
                </div>
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-[#1f2957]">Custos da Viatura</h2>
                <p className="text-sm text-slate-500">Registe seguros, manutenções, IPO, IUC, portagens, combustível e outros custos com suporte a upload de documentos.</p>
                <button
                    onClick={() => setProfileTab('costs')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors"
                >
                    Abrir Gestão de Custos →
                </button>
            </div>

            {/* Timeline in overview */}
            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                <h2 className="text-base font-bold text-[#1f2957] mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Cronograma</h2>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                    {timeline.slice(0, 20).map(event => (
                        <div key={event.id} className="flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className={`mt-0.5 shrink-0 ${event.type === 'alert' ? 'text-amber-400' : 'text-blue-400'}`}>
                                {event.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-slate-900 font-semibold text-sm">{event.title}</div>
                                <div className="text-slate-400 text-xs truncate">{event.subtitle}</div>
                            </div>
                            <div className="text-slate-500 text-xs whitespace-nowrap shrink-0">{new Date(event.date).toLocaleDateString('pt-PT')}</div>
                        </div>
                    ))}
                    {timeline.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Sem eventos.</p>}
                </div>
            </div>

            </>) /* END overview tab */}

            {/* ====================================================
                TAB: CUSTOS DA VIATURA
            ==================================================== */}
            {profileTab === 'costs' && viaturaId && (
                <VehicleCostsTab
                    viaturaId={viaturaId}
                    viatura={viatura}
                    motoristas={motoristas}
                    vehicleFuelTransactions={vehicleFuelTransactions}
                    onRefresh={loadVehicleProfileAggregates}
                />
            )}

            {/* ====================================================
                TAB: HISTÓRICO
            ==================================================== */}
            {profileTab === 'history' && (
            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-[#1f2957]">Histórico de Custos</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} />
                    <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} />
                    <select className="px-3 py-2 rounded-lg border border-slate-200" value={historyCategoryFilter} onChange={(e) => setHistoryCategoryFilter(e.target.value as 'all' | VehicleCostHistoryRow['category'])}>
                        <option value="all">Todas as categorias</option>
                        <option value="combustivel">Combustível</option>
                        <option value="manutencao">Manutenção</option>
                        <option value="seguros">Seguros</option>
                        <option value="inspecoes">Inspeções</option>
                        <option value="iuc">IUC</option>
                        <option value="portagens">Portagens</option>
                        <option value="outros">Outros</option>
                    </select>
                    <select className="px-3 py-2 rounded-lg border border-slate-200" value={historyYearFilter} onChange={(e) => setHistoryYearFilter(e.target.value)}>
                        <option value="all">Todos os anos</option>
                        {historyYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="text-xs text-slate-500">{filteredCostHistory.length} registos • Total: {filteredCostHistory.reduce((a, r) => a + Number(r.amount || 0), 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€</div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-200">
                                <th className="text-left py-2">Data</th>
                                <th className="text-left py-2">Categoria</th>
                                <th className="text-left py-2">Descrição</th>
                                <th className="text-left py-2">Valor</th>
                                <th className="text-left py-2">Documento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCostHistory.map(item => (
                                <tr key={`${item.source_table}-${item.source_id}`} className="border-b border-slate-200/60 text-slate-300">
                                    <td className="py-2">{new Date(item.event_date).toLocaleDateString('pt-PT')}</td>
                                    <td className="py-2 capitalize">{item.category}</td>
                                    <td className="py-2">{item.description || '—'}</td>
                                    <td className="py-2 font-semibold">{Number(item.amount || 0).toFixed(2)}€</td>
                                    <td className="py-2">
                                        {item.document_url
                                            ? <a href={item.document_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Abrir</a>
                                            : <span className="text-slate-500">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredCostHistory.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">Sem custos no filtro selecionado.</p>}
                </div>
            </div>
            )} {/* END history tab */}

            {/* ====================================================
                TAB: ANÁLISE
            ==================================================== */}
            {profileTab === 'analysis' && (<>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h2 className="text-base font-bold text-[#1f2957] mb-4">Requisições por viatura</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-200">
                                    <th className="text-left py-2">Nº</th>
                                    <th className="text-left py-2">Data</th>
                                    <th className="text-left py-2">Peça/Material</th>
                                    <th className="text-left py-2">Qtd</th>
                                    <th className="text-left py-2">Custo</th>
                                    <th className="text-left py-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicleRequisitions.map(req => {
                                    const itemsText = (req.itens || []).map(i => i.descricao).filter(Boolean).join(', ') || '—';
                                    const qty = (req.itens || []).reduce((acc, i) => acc + Number(i.quantidade || 0), 0);
                                    const cost = requisitionCost(req);

                                    return (
                                        <tr key={req.id} className="border-b border-slate-200/60 text-slate-300">
                                            <td className="py-2 font-mono">{req.numero}</td>
                                            <td className="py-2">{new Date(req.data).toLocaleDateString('pt-PT')}</td>
                                            <td className="py-2 max-w-[260px] truncate" title={itemsText}>{itemsText}</td>
                                            <td className="py-2">{qty || '—'}</td>
                                            <td className="py-2">{cost.toFixed(2)}€</td>
                                            <td className="py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs border ${(req.status || 'pendente') === 'concluida' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                    {(req.status || 'pendente') === 'concluida' ? 'Concluído' : 'Pendente'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {vehicleRequisitions.length === 0 && <p className="text-slate-500 py-6 text-center">Sem requisições associadas.</p>}
                    </div>
                </div>

                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h2 className="text-lg font-bold text-[#1f2957] mb-4">Histórico de Combustível</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-200">
                                    <th className="text-left py-2">Data/Hora</th>
                                    <th className="text-left py-2">Litros</th>
                                    <th className="text-left py-2">€/L</th>
                                    <th className="text-left py-2">Custo</th>
                                    <th className="text-left py-2">Km</th>
                                    <th className="text-left py-2">Motorista</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicleFuelTransactions.map(tx => {
                                    const motorista = motoristas.find(m => m.id === tx.driverId);
                                    const { date, time } = formatDateTime(tx.timestamp);
                                    return (
                                        <tr key={tx.id} className="border-b border-slate-200/60 text-slate-300">
                                            <td className="py-2">
                                                <div className="flex flex-col leading-tight">
                                                    <span>{date}</span>
                                                    <span className="text-[10px] text-slate-500">{time}</span>
                                                </div>
                                            </td>
                                            <td className="py-2">{Number(tx.liters || 0).toFixed(2)}</td>
                                            <td className="py-2">{Number(tx.pricePerLiter || tx.price_per_liter || 0).toFixed(3)}</td>
                                            <td className="py-2">{Number(tx.totalCost || tx.total_cost || 0).toFixed(2)}€</td>
                                            <td className="py-2">{Number(tx.km || 0).toLocaleString('pt-PT')}</td>
                                            <td className="py-2">{motorista?.nome || tx.staffName || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {vehicleFuelTransactions.length === 0 && <p className="text-slate-500 py-6 text-center">Sem abastecimentos associados.</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <div className="bg-slate-100 rounded-lg p-3">
                            <div className="text-xs text-slate-500 uppercase">Total Litros</div>
                            <div className="text-slate-900 font-bold">{totalLiters.toFixed(2)} L</div>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-3">
                            <div className="text-xs text-slate-500 uppercase">Consumo Médio</div>
                            <div className="text-slate-900 font-bold">{averageConsumption.toFixed(2)} L/100km</div>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-3">
                            <div className="text-xs text-slate-500 uppercase">Total Combustível</div>
                            <div className="text-slate-900 font-bold">{totalFuelCost.toFixed(2)}€</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h3 className="text-slate-900 font-bold mb-4">Combustível por mês</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyFuel}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="month" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip />
                                <Bar dataKey="cost" fill="#3b82f6" name="Custo (€)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h3 className="text-slate-900 font-bold mb-4">Custos de manutenção por mês</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyMaintenance}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="month" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip />
                                <Bar dataKey="cost" fill="#f59e0b" name="Custo (€)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h3 className="text-slate-900 font-bold mb-4">Consumo médio ao longo do tempo</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={consumptionSql.length
                                    ? consumptionSql.map(item => ({ date: item.month, consumo: item.average_consumption }))
                                    : consumptionSeries.filter(item => typeof item.consumo === 'number').map(item => ({ date: new Date(item.date).toLocaleDateString('pt-PT'), consumo: item.consumo }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="date" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip />
                                <Line type="monotone" dataKey="consumo" stroke="#10b981" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h3 className="text-slate-900 font-bold mb-4">Litros abastecidos</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyFuel}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="month" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip />
                                <Area type="monotone" dataKey="liters" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            </>) /* END analysis tab */}
        </div>
    );
}
