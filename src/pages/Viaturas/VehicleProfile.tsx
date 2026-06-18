import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Car, Fuel, Wrench, ClipboardList, Gauge, CalendarClock, AlertTriangle, ShieldCheck, FileSearch, Receipt, PlusCircle } from 'lucide-react';
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
    const [insurancePolicies, setInsurancePolicies] = useState<VehicleInsurancePolicy[]>([]);
    const [inspectionRecords, setInspectionRecords] = useState<VehicleInspection[]>([]);
    const [iucRecords, setIucRecords] = useState<VehicleIucRecord[]>([]);
    const [otherCosts, setOtherCosts] = useState<VehicleOtherCost[]>([]);
    const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'all' | VehicleCostHistoryRow['category']>('all');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [isSavingCost, setIsSavingCost] = useState(false);

    const [insuranceForm, setInsuranceForm] = useState({
        insurer: '',
        policy_number: '',
        start_date: '',
        end_date: '',
        premium_amount: '',
        payment_frequency: 'annual' as VehicleInsurancePolicy['payment_frequency'],
        document_url: ''
    });

    const [inspectionForm, setInspectionForm] = useState({
        inspection_date: '',
        valid_until: '',
        result: 'approved',
        cost: '',
        document_url: ''
    });

    const [iucForm, setIucForm] = useState({
        fiscal_year: String(new Date().getFullYear()),
        amount: '',
        due_date: '',
        payment_date: '',
        status: 'pending' as VehicleIucRecord['status'],
        document_url: ''
    });

    const [otherCostForm, setOtherCostForm] = useState({
        cost_category: 'outros' as VehicleOtherCost['cost_category'],
        cost_date: new Date().toISOString().slice(0, 10),
        description: '',
        amount: '',
        km: '',
        driver_id: '',
        document_url: ''
    });

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
            if (!insuranceResult.error) setInsurancePolicies((insuranceResult.data || []) as VehicleInsurancePolicy[]);
            if (!inspectionsResult.error) setInspectionRecords((inspectionsResult.data || []) as VehicleInspection[]);
            if (!iucResult.error) setIucRecords((iucResult.data || []) as VehicleIucRecord[]);
            if (!otherCostsResult.error) {
                setOtherCosts((otherCostsResult.data || []).map((row: any) => ({
                    ...row,
                    amount: Number(row.amount || 0),
                    km: row.km === null || row.km === undefined ? undefined : Number(row.km)
                })) as VehicleOtherCost[]);
            }

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

    const filteredCostHistory = costHistorySql.filter(item => {
        if (historyCategoryFilter !== 'all' && item.category !== historyCategoryFilter) return false;

        const d = new Date(item.event_date);
        if (Number.isNaN(d.getTime())) return false;

        if (historyStartDate) {
            const start = new Date(`${historyStartDate}T00:00:00`);
            if (d < start) return false;
        }

        if (historyEndDate) {
            const end = new Date(`${historyEndDate}T23:59:59`);
            if (d > end) return false;
        }

        return true;
    });

    const addInsurancePolicy = async () => {
        if (!viaturaId || !insuranceForm.insurer || !insuranceForm.policy_number || !insuranceForm.start_date || !insuranceForm.end_date) return;
        setIsSavingCost(true);
        const payload = {
            vehicle_id: viaturaId,
            insurer: insuranceForm.insurer,
            policy_number: insuranceForm.policy_number,
            start_date: insuranceForm.start_date,
            end_date: insuranceForm.end_date,
            premium_amount: Number(insuranceForm.premium_amount || 0),
            payment_frequency: insuranceForm.payment_frequency,
            document_url: insuranceForm.document_url || null
        };

        const { error } = await supabase.from('vehicle_insurance_policies').insert(payload);
        setIsSavingCost(false);
        if (error) {
            alert(`Erro ao registar seguro: ${error.message}`);
            return;
        }
        setInsuranceForm({ insurer: '', policy_number: '', start_date: '', end_date: '', premium_amount: '', payment_frequency: 'annual', document_url: '' });
        await loadVehicleProfileAggregates();
    };

    const addInspection = async () => {
        if (!viaturaId || !inspectionForm.inspection_date) return;
        setIsSavingCost(true);
        const { error } = await supabase.from('vehicle_inspections').insert({
            vehicle_id: viaturaId,
            inspection_date: inspectionForm.inspection_date,
            valid_until: inspectionForm.valid_until || null,
            result: inspectionForm.result,
            cost: Number(inspectionForm.cost || 0),
            document_url: inspectionForm.document_url || null
        });
        setIsSavingCost(false);
        if (error) {
            alert(`Erro ao registar inspeção: ${error.message}`);
            return;
        }
        setInspectionForm({ inspection_date: '', valid_until: '', result: 'approved', cost: '', document_url: '' });
        await loadVehicleProfileAggregates();
    };

    const addIuc = async () => {
        if (!viaturaId || !iucForm.fiscal_year) return;
        setIsSavingCost(true);
        const { error } = await supabase.from('vehicle_iuc_records').upsert({
            vehicle_id: viaturaId,
            fiscal_year: Number(iucForm.fiscal_year),
            amount: Number(iucForm.amount || 0),
            due_date: iucForm.due_date || null,
            payment_date: iucForm.payment_date || null,
            status: iucForm.status,
            document_url: iucForm.document_url || null
        }, { onConflict: 'vehicle_id,fiscal_year' });
        setIsSavingCost(false);
        if (error) {
            alert(`Erro ao registar IUC: ${error.message}`);
            return;
        }
        setIucForm({ fiscal_year: String(new Date().getFullYear()), amount: '', due_date: '', payment_date: '', status: 'pending', document_url: '' });
        await loadVehicleProfileAggregates();
    };

    const addOtherCost = async () => {
        if (!viaturaId || !otherCostForm.cost_date) return;
        setIsSavingCost(true);
        const { error } = await supabase.from('vehicle_other_costs').insert({
            vehicle_id: viaturaId,
            cost_category: otherCostForm.cost_category,
            cost_date: otherCostForm.cost_date,
            description: otherCostForm.description || null,
            amount: Number(otherCostForm.amount || 0),
            km: otherCostForm.km ? Number(otherCostForm.km) : null,
            driver_id: otherCostForm.driver_id || null,
            document_url: otherCostForm.document_url || null
        });
        setIsSavingCost(false);
        if (error) {
            alert(`Erro ao registar outro custo: ${error.message}`);
            return;
        }
        setOtherCostForm({ cost_category: 'outros', cost_date: new Date().toISOString().slice(0, 10), description: '', amount: '', km: '', driver_id: '', document_url: '' });
        await loadVehicleProfileAggregates();
    };

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

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/viaturas')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 border border-slate-200 text-slate-300 hover:text-slate-900 rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar à Frota
                </button>
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="text-slate-400 text-sm">Perfil da Viatura</div>
                        <h1 className="text-3xl font-black text-slate-900 mt-1">{viatura.marca} {viatura.modelo}</h1>
                        <div className="mt-3 flex items-center gap-3 text-sm">
                            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-200 font-mono">{viatura.matricula}</span>
                            <span className="text-slate-400">Ano {viatura.ano || 'N/A'}</span>
                            <span className={`px-2 py-1 rounded border ${statusColor}`}>{vehicleStatus}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs uppercase tracking-wider text-slate-500">Quilometragem Atual</div>
                        <div className="text-2xl font-black text-slate-900">{currentKm.toLocaleString('pt-PT')} km</div>
                    </div>
                </div>
            </div>

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

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-[#1f2957]">Registo de Custos</h2>
                    <span className="text-xs text-slate-500">Seguro, IPO, IUC e outros custos</span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <form
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); void addInsurancePolicy(); }}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="w-4 h-4" /> Seguro</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Seguradora" value={insuranceForm.insurer} onChange={(e) => setInsuranceForm(prev => ({ ...prev, insurer: e.target.value }))} />
                            <input className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Nº apólice" value={insuranceForm.policy_number} onChange={(e) => setInsuranceForm(prev => ({ ...prev, policy_number: e.target.value }))} />
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={insuranceForm.start_date} onChange={(e) => setInsuranceForm(prev => ({ ...prev, start_date: e.target.value }))} />
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={insuranceForm.end_date} onChange={(e) => setInsuranceForm(prev => ({ ...prev, end_date: e.target.value }))} />
                            <input type="number" step="0.01" className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Valor" value={insuranceForm.premium_amount} onChange={(e) => setInsuranceForm(prev => ({ ...prev, premium_amount: e.target.value }))} />
                            <select className="px-3 py-2 rounded-lg border border-slate-200" value={insuranceForm.payment_frequency} onChange={(e) => setInsuranceForm(prev => ({ ...prev, payment_frequency: e.target.value as VehicleInsurancePolicy['payment_frequency'] }))}>
                                <option value="monthly">Mensal</option>
                                <option value="quarterly">Trimestral</option>
                                <option value="annual">Anual</option>
                            </select>
                            <input className="px-3 py-2 rounded-lg border border-slate-200 md:col-span-2" placeholder="URL documento PDF" value={insuranceForm.document_url} onChange={(e) => setInsuranceForm(prev => ({ ...prev, document_url: e.target.value }))} />
                        </div>
                        <button disabled={isSavingCost} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"><PlusCircle className="w-4 h-4" /> Guardar Seguro</button>
                    </form>

                    <form
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); void addInspection(); }}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileSearch className="w-4 h-4" /> Inspeção (IPO)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={inspectionForm.inspection_date} onChange={(e) => setInspectionForm(prev => ({ ...prev, inspection_date: e.target.value }))} />
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={inspectionForm.valid_until} onChange={(e) => setInspectionForm(prev => ({ ...prev, valid_until: e.target.value }))} />
                            <select className="px-3 py-2 rounded-lg border border-slate-200" value={inspectionForm.result} onChange={(e) => setInspectionForm(prev => ({ ...prev, result: e.target.value }))}>
                                <option value="approved">Aprovada</option>
                                <option value="conditional">Aprovada com anotações</option>
                                <option value="failed">Reprovada</option>
                            </select>
                            <input type="number" step="0.01" className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Custo" value={inspectionForm.cost} onChange={(e) => setInspectionForm(prev => ({ ...prev, cost: e.target.value }))} />
                            <input className="px-3 py-2 rounded-lg border border-slate-200 md:col-span-2" placeholder="URL documento PDF" value={inspectionForm.document_url} onChange={(e) => setInspectionForm(prev => ({ ...prev, document_url: e.target.value }))} />
                        </div>
                        <button disabled={isSavingCost} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"><PlusCircle className="w-4 h-4" /> Guardar Inspeção</button>
                    </form>

                    <form
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); void addIuc(); }}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Receipt className="w-4 h-4" /> IUC</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input type="number" className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Ano fiscal" value={iucForm.fiscal_year} onChange={(e) => setIucForm(prev => ({ ...prev, fiscal_year: e.target.value }))} />
                            <input type="number" step="0.01" className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Valor" value={iucForm.amount} onChange={(e) => setIucForm(prev => ({ ...prev, amount: e.target.value }))} />
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={iucForm.due_date} onChange={(e) => setIucForm(prev => ({ ...prev, due_date: e.target.value }))} />
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={iucForm.payment_date} onChange={(e) => setIucForm(prev => ({ ...prev, payment_date: e.target.value }))} />
                            <select className="px-3 py-2 rounded-lg border border-slate-200" value={iucForm.status} onChange={(e) => setIucForm(prev => ({ ...prev, status: e.target.value as VehicleIucRecord['status'] }))}>
                                <option value="pending">Pendente</option>
                                <option value="paid">Pago</option>
                            </select>
                            <input className="px-3 py-2 rounded-lg border border-slate-200" placeholder="URL comprovativo" value={iucForm.document_url} onChange={(e) => setIucForm(prev => ({ ...prev, document_url: e.target.value }))} />
                        </div>
                        <button disabled={isSavingCost} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"><PlusCircle className="w-4 h-4" /> Guardar IUC</button>
                    </form>

                    <form
                        className="border border-slate-200 rounded-xl p-4 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); void addOtherCost(); }}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="w-4 h-4" /> Outros Custos</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <select className="px-3 py-2 rounded-lg border border-slate-200" value={otherCostForm.cost_category} onChange={(e) => setOtherCostForm(prev => ({ ...prev, cost_category: e.target.value as VehicleOtherCost['cost_category'] }))}>
                                <option value="lavagem">Lavagem</option>
                                <option value="pneus">Pneus</option>
                                <option value="estacionamento">Estacionamento</option>
                                <option value="multa">Multa</option>
                                <option value="pecas">Peças</option>
                                <option value="reparacao_extraordinaria">Reparação Extraordinária</option>
                                <option value="outros">Outros</option>
                            </select>
                            <input type="date" className="px-3 py-2 rounded-lg border border-slate-200" value={otherCostForm.cost_date} onChange={(e) => setOtherCostForm(prev => ({ ...prev, cost_date: e.target.value }))} />
                            <input type="number" step="0.01" className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Valor" value={otherCostForm.amount} onChange={(e) => setOtherCostForm(prev => ({ ...prev, amount: e.target.value }))} />
                            <input type="number" className="px-3 py-2 rounded-lg border border-slate-200" placeholder="Km (opcional)" value={otherCostForm.km} onChange={(e) => setOtherCostForm(prev => ({ ...prev, km: e.target.value }))} />
                            <select className="px-3 py-2 rounded-lg border border-slate-200" value={otherCostForm.driver_id} onChange={(e) => setOtherCostForm(prev => ({ ...prev, driver_id: e.target.value }))}>
                                <option value="">Sem motorista</option>
                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select>
                            <input className="px-3 py-2 rounded-lg border border-slate-200" placeholder="URL comprovativo" value={otherCostForm.document_url} onChange={(e) => setOtherCostForm(prev => ({ ...prev, document_url: e.target.value }))} />
                            <input className="px-3 py-2 rounded-lg border border-slate-200 md:col-span-2" placeholder="Descrição" value={otherCostForm.description} onChange={(e) => setOtherCostForm(prev => ({ ...prev, description: e.target.value }))} />
                        </div>
                        <button disabled={isSavingCost} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"><PlusCircle className="w-4 h-4" /> Guardar Custo</button>
                    </form>
                </div>
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-[#1f2957] mb-4">Histórico de Custos</h2>
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
                    <select className="px-3 py-2 rounded-lg border border-slate-200" value={viaturaId || ''} disabled>
                        <option value={viaturaId || ''}>{viatura.matricula}</option>
                    </select>
                </div>

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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                    <h2 className="text-lg font-bold text-[#1f2957] mb-4">Histórico de Requisições</h2>
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

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-[#1f2957] mb-4">Cronograma / Timeline</h2>
                <div className="space-y-3">
                    {timeline.map(event => (
                        <div key={event.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className={`mt-0.5 ${event.type === 'alert' ? 'text-amber-400' : 'text-blue-400'}`}>
                                {event.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                                <div className="text-slate-900 font-semibold text-sm">{event.title}</div>
                                <div className="text-slate-400 text-xs">{event.subtitle}</div>
                            </div>
                            <div className="text-slate-500 text-xs whitespace-nowrap">{new Date(event.date).toLocaleDateString('pt-PT')}</div>
                        </div>
                    ))}
                    {timeline.length === 0 && <p className="text-slate-500 text-center py-4">Sem eventos para esta viatura.</p>}
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
        </div>
    );
}
