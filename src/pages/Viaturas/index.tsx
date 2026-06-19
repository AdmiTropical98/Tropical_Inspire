import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Trash2, Car, Calendar, Info, LayoutTemplate,
    List, PlusCircle, Wrench, AlertTriangle, Fuel, CheckCircle, ArrowRight,
    Upload, Download, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { VehicleInsurancePolicy, Viatura } from '../../types';
import { supabase } from '../../lib/supabase';

type FleetFinancialDashboard = {
    total_fleet_cost: number;
    total_fuel_cost: number;
    total_maintenance_cost: number;
    total_insurance_cost: number;
    total_iuc_cost: number;
    total_tolls_cost: number;
    total_inspection_cost: number;
    total_other_costs: number;
    most_expensive_vehicle_id?: string;
    most_expensive_vehicle_plate?: string;
    most_expensive_vehicle_cost?: number;
};

type FleetMonthlyCost = {
    month: string;
    category: string;
    total_amount: number;
};

type VehicleFinancialSummaryRow = {
    vehicle_id: string;
    total_vehicle_cost: number;
};

type InsuranceExportStatus = 'active' | 'expiring_soon' | 'expired' | 'all';

type InsuranceExportRow = {
    matricula: string;
    marca: string;
    modelo: string;
    ano: string;
    seguradora: string;
    apolice: string;
    dataInicio: string;
    dataFim: string;
    premio: number;
    frequencia: string;
    estado: string;
    documento: string;
    criadoEm: string;
};

export default function Viaturas() {
    const navigate = useNavigate();
    const { viaturas, addViatura, deleteViatura } = useWorkshop();
    const { t } = useTranslation();

    // Navigation
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'create'>('overview');

    const [filter, setFilter] = useState('');
    const [insuranceExportStatus, setInsuranceExportStatus] = useState<InsuranceExportStatus>('active');
    const [insuranceExportStartDate, setInsuranceExportStartDate] = useState('');
    const [insuranceExportEndDate, setInsuranceExportEndDate] = useState('');
    const [isExportingInsuranceExcel, setIsExportingInsuranceExcel] = useState(false);
    const [isExportingInsurancePdf, setIsExportingInsurancePdf] = useState(false);
    const [financialDashboard, setFinancialDashboard] = useState<FleetFinancialDashboard | null>(null);
    const [fleetMonthlyCosts, setFleetMonthlyCosts] = useState<FleetMonthlyCost[]>([]);
    const [vehicleCostRows, setVehicleCostRows] = useState<VehicleFinancialSummaryRow[]>([]);

    useEffect(() => {
        const loadFleetFinancials = async () => {
            const [dashboardResult, monthlyResult, vehicleRowsResult] = await Promise.all([
                supabase.from('fleet_financial_dashboard').select('*').limit(1).maybeSingle(),
                supabase.from('fleet_financial_monthly').select('*').order('month', { ascending: true }).limit(200),
                supabase.from('vehicle_financial_summary').select('vehicle_id,total_vehicle_cost').order('total_vehicle_cost', { ascending: false }).limit(10)
            ]);

            if (!dashboardResult.error) {
                const row = dashboardResult.data as any;
                setFinancialDashboard(row ? {
                    ...row,
                    total_fleet_cost: Number(row.total_fleet_cost || 0),
                    total_fuel_cost: Number(row.total_fuel_cost || 0),
                    total_maintenance_cost: Number(row.total_maintenance_cost || 0),
                    total_insurance_cost: Number(row.total_insurance_cost || 0),
                    total_iuc_cost: Number(row.total_iuc_cost || 0),
                    total_tolls_cost: Number(row.total_tolls_cost || 0),
                    total_inspection_cost: Number(row.total_inspection_cost || 0),
                    total_other_costs: Number(row.total_other_costs || 0),
                    most_expensive_vehicle_cost: Number(row.most_expensive_vehicle_cost || 0)
                } : null);
            }

            if (!monthlyResult.error) {
                setFleetMonthlyCosts((monthlyResult.data || []).map((row: any) => ({
                    month: row.month,
                    category: row.category,
                    total_amount: Number(row.total_amount || 0)
                })));
            }

            if (!vehicleRowsResult.error) {
                setVehicleCostRows((vehicleRowsResult.data || []).map((row: any) => ({
                    vehicle_id: row.vehicle_id,
                    total_vehicle_cost: Number(row.total_vehicle_cost || 0)
                })));
            }
        };

        void loadFleetFinancials();
    }, []);

    const monthlyTotalSeries = useMemo(() => {
        const grouped = fleetMonthlyCosts.reduce((acc, row) => {
            acc[row.month] = (acc[row.month] || 0) + row.total_amount;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped)
            .map(([month, total]) => ({ month, total }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-12);
    }, [fleetMonthlyCosts]);

    const maxMonthly = monthlyTotalSeries.length ? Math.max(...monthlyTotalSeries.map(item => item.total), 1) : 1;

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

    const getInsuranceFrequencyLabel = (frequency: VehicleInsurancePolicy['payment_frequency']) => {
        if (frequency === 'monthly') return 'Mensal';
        if (frequency === 'quarterly') return 'Trimestral';
        return 'Anual';
    };

    const getInsuranceStatus = (policy: VehicleInsurancePolicy, now = new Date()) => {
        const endDate = new Date(policy.end_date);

        if (Number.isNaN(endDate.getTime())) return 'Ativo';
        if (endDate < now) return 'Expirado';
        if (endDate <= new Date(now.getTime() + 30 * 86400000)) return 'Expira em breve';
        return 'Ativo';
    };

    const matchesInsuranceExportFilters = (policy: VehicleInsurancePolicy) => {
        const now = new Date();
        const endDate = new Date(policy.end_date);
        const status = getInsuranceStatus(policy, now);

        if (insuranceExportStatus === 'active' && status !== 'Ativo') return false;
        if (insuranceExportStatus === 'expiring_soon' && status !== 'Expira em breve') return false;
        if (insuranceExportStatus === 'expired' && status !== 'Expirado') return false;

        if (insuranceExportStartDate) {
            const startLimit = new Date(`${insuranceExportStartDate}T00:00:00`);
            if (Number.isNaN(endDate.getTime()) || endDate < startLimit) return false;
        }

        if (insuranceExportEndDate) {
            const endLimit = new Date(`${insuranceExportEndDate}T23:59:59`);
            if (Number.isNaN(endDate.getTime()) || endDate > endLimit) return false;
        }

        return true;
    };

    const buildInsuranceExportRows = (policies: VehicleInsurancePolicy[]): InsuranceExportRow[] => {
        const vehicleById = new Map(viaturas.map(vehicle => [vehicle.id, vehicle]));

        return policies
            .filter(matchesInsuranceExportFilters)
            .map((policy) => {
                const vehicle = vehicleById.get(policy.vehicle_id);

                return {
                    matricula: vehicle?.matricula ?? 'Sem matrícula',
                    marca: vehicle?.marca ?? '',
                    modelo: vehicle?.modelo ?? '',
                    ano: vehicle?.ano ?? '',
                    seguradora: policy.insurer,
                    apolice: policy.policy_number,
                    dataInicio: policy.start_date,
                    dataFim: policy.end_date,
                    premio: Number(policy.premium_amount ?? 0),
                    frequencia: getInsuranceFrequencyLabel(policy.payment_frequency),
                    estado: getInsuranceStatus(policy),
                    documento: policy.document_url ?? '',
                    criadoEm: policy.created_at ?? '',
                };
            });
    };

    const fetchInsuranceExportRows = async () => {
        const { data, error } = await supabase
            .from('vehicle_insurance_policies')
            .select('*')
            .order('end_date', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        return buildInsuranceExportRows((data ?? []) as VehicleInsurancePolicy[]);
    };

    const insuranceExportSummary = useMemo(() => {
        const parts = [];

        if (insuranceExportStatus === 'active') parts.push('ativos');
        if (insuranceExportStatus === 'expiring_soon') parts.push('a expirar');
        if (insuranceExportStatus === 'expired') parts.push('expirados');
        if (insuranceExportStatus === 'all') parts.push('todos os estados');
        if (insuranceExportStartDate) parts.push(`de ${insuranceExportStartDate}`);
        if (insuranceExportEndDate) parts.push(`até ${insuranceExportEndDate}`);

        return parts.join(' • ');
    }, [insuranceExportEndDate, insuranceExportStartDate, insuranceExportStatus]);

    const handleExportInsuranceExcel = async () => {
        setIsExportingInsuranceExcel(true);

        try {
            const rows = await fetchInsuranceExportRows();

            if (rows.length === 0) {
                alert('Não existem seguros com os filtros selecionados para exportar.');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(rows.map(row => ({
                'Matricula': row.matricula,
                'Marca': row.marca,
                'Modelo': row.modelo,
                'Ano': row.ano,
                'Seguradora': row.seguradora,
                'Apólice': row.apolice,
                'Data Início': row.dataInicio,
                'Data Fim': row.dataFim,
                'Prémio (€)': row.premio,
                'Frequência': row.frequencia,
                'Estado': row.estado,
                'Documento': row.documento,
                'Criado Em': row.criadoEm,
            })));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Seguros');
            XLSX.writeFile(workbook, `Seguros_Viaturas_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            alert(`Erro ao exportar seguros: ${error instanceof Error ? error.message : 'Erro desconhecido.'}`);
        } finally {
            setIsExportingInsuranceExcel(false);
        }
    };

    const handleExportInsurancePdf = async () => {
        setIsExportingInsurancePdf(true);

        try {
            const rows = await fetchInsuranceExportRows();

            if (rows.length === 0) {
                alert('Não existem seguros com os filtros selecionados para exportar.');
                return;
            }

            const doc = new jsPDF('l', 'mm', 'a4');
            doc.setFontSize(16);
            doc.text('Seguros das Viaturas', 14, 16);
            doc.setFontSize(10);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-PT')}`, 14, 22);
            if (insuranceExportSummary) {
                doc.text(`Filtros: ${insuranceExportSummary}`, 14, 28);
            }

            autoTable(doc, {
                startY: insuranceExportSummary ? 34 : 28,
                head: [['Matrícula', 'Seguradora', 'Apólice', 'Início', 'Fim', 'Prémio', 'Freq.', 'Estado']],
                body: rows.map(row => [
                    row.matricula,
                    row.seguradora,
                    row.apolice,
                    row.dataInicio || '—',
                    row.dataFim || '—',
                    `${row.premio.toFixed(2)} €`,
                    row.frequencia,
                    row.estado,
                ]),
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [31, 41, 87] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            doc.save(`Seguros_Viaturas_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            alert(`Erro ao exportar PDF dos seguros: ${error instanceof Error ? error.message : 'Erro desconhecido.'}`);
        } finally {
            setIsExportingInsurancePdf(false);
        }
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
        <div className="frota-page frota-page--viaturas android-native-vehicles flex flex-col text-slate-900">
            {/* Full Page Container */}
            <div className="flex flex-col">
                {/* Scrollable Content Area */}
                <div className="frota-page-body space-y-10">

                    {/* Header Section */}
                    <div className="frota-page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-3xl font-extrabold text-[#1f2957] tracking-tight mb-2 flex items-center gap-4">
                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                                    {t('vehicles.title')}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-bold border border-blue-200">
                                    {stats.total}
                                </span>
                            </h1>
                            <p className="text-slate-500 text-base font-medium max-w-2xl">
                                {t('subtitle.vehicles')}
                            </p>
                        </div>

                        <div className="w-full md:w-auto space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <select
                                        value={insuranceExportStatus}
                                        onChange={(e) => setInsuranceExportStatus(e.target.value as InsuranceExportStatus)}
                                        className="bg-transparent text-sm font-medium outline-none w-full"
                                    >
                                        <option value="active">Ativos</option>
                                        <option value="expiring_soon">A expirar em 30 dias</option>
                                        <option value="expired">Expirados</option>
                                        <option value="all">Todos</option>
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        value={insuranceExportStartDate}
                                        onChange={(e) => setInsuranceExportStartDate(e.target.value)}
                                        className="bg-transparent text-sm font-medium outline-none w-full"
                                    />
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        value={insuranceExportEndDate}
                                        onChange={(e) => setInsuranceExportEndDate(e.target.value)}
                                        className="bg-transparent text-sm font-medium outline-none w-full"
                                    />
                                </label>
                                <button
                                    onClick={() => {
                                        setInsuranceExportStatus('active');
                                        setInsuranceExportStartDate('');
                                        setInsuranceExportEndDate('');
                                    }}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all"
                                >
                                    Limpar Filtros
                                </button>
                            </div>

                            <div className="frota-page-toolbar flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => void handleExportInsuranceExcel()}
                                    disabled={isExportingInsuranceExcel || isExportingInsurancePdf}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-xl font-medium transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden md:inline">{isExportingInsuranceExcel ? 'A exportar Excel...' : 'Exportar Seguros Excel'}</span>
                                </button>
                                <button
                                    onClick={() => void handleExportInsurancePdf()}
                                    disabled={isExportingInsuranceExcel || isExportingInsurancePdf}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-xl font-medium transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden md:inline">{isExportingInsurancePdf ? 'A exportar PDF...' : 'Exportar Seguros PDF'}</span>
                                </button>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-xl font-medium transition-all shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden md:inline">Template</span>
                                </button>
                                <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-xl font-medium transition-all shadow-sm cursor-pointer">
                                    <Upload className="w-4 h-4" />
                                    <span className="hidden md:inline">Importar</span>
                                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                </label>
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className="flex items-center gap-2 px-6 py-2.5 btn-primary rounded-xl font-bold transition-all"
                                >
                                    <PlusCircle className="w-5 h-5" />
                                    <span>Nova Viatura</span>
                                </button>
                            </div>

                            <div className="text-xs text-slate-500">
                                Exportação de seguros: {insuranceExportSummary || 'ativos'}
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="frota-segmented-tabs android-native-vehicles-tabs flex items-center gap-2 border-b border-slate-200">
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
                                        ? 'border-[#d59d31] text-[#1f2957] bg-amber-50/60'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
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
                                <div className="android-native-vehicles-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                    <div className="kpi-card relative overflow-visible group hover:shadow-md hover:-translate-y-0.5 transition-all">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Car className="w-32 h-32 text-blue-500" />
                                        </div>
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20">
                                                <Car className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Total de Viaturas</h3>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className="text-4xl font-black text-slate-900">{stats.total}</span>
                                                <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    {stats.active} Ativas
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="kpi-card relative overflow-visible group hover:shadow-md hover:-translate-y-0.5 transition-all">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Wrench className="w-32 h-32 text-amber-500" />
                                        </div>
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 border border-amber-500/20">
                                                <Wrench className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Em Manutenção</h3>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className="text-4xl font-black text-slate-900">{stats.maintenance}</span>
                                                {stats.maintenance > 0 && (
                                                    <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                                        Requer Atenção
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="kpi-card relative overflow-visible group hover:shadow-md hover:-translate-y-0.5 transition-all">
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Fuel className="w-32 h-32 text-purple-500" />
                                        </div>
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-4 border border-purple-500/20">
                                                <Fuel className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Consumo Médio</h3>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className="text-4xl font-black text-slate-900">7.8</span>
                                                <span className="text-base text-slate-400 font-medium">L/100km</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="surface-card p-6">
                                    <h3 className="text-base font-bold text-slate-800 mb-4">Dashboard Geral da Frota</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                            <p className="text-xs uppercase text-slate-500">Custo Total da Frota</p>
                                            <p className="text-2xl font-black text-slate-900 mt-1">{(financialDashboard?.total_fleet_cost || 0).toFixed(2)}€</p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                            <p className="text-xs uppercase text-slate-500">Veículo Mais Caro</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">{financialDashboard?.most_expensive_vehicle_plate || '—'}</p>
                                            <p className="text-sm text-slate-500">{(financialDashboard?.most_expensive_vehicle_cost || 0).toFixed(2)}€</p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                            <p className="text-xs uppercase text-slate-500">Combustível</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">{(financialDashboard?.total_fuel_cost || 0).toFixed(2)}€</p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                            <p className="text-xs uppercase text-slate-500">Manutenção</p>
                                            <p className="text-lg font-black text-slate-900 mt-1">{(financialDashboard?.total_maintenance_cost || 0).toFixed(2)}€</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                                        <div className="p-4 rounded-xl border border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-700 mb-3">Evolução mensal dos custos</h4>
                                            <div className="space-y-2">
                                                {monthlyTotalSeries.map(item => (
                                                    <div key={item.month} className="space-y-1">
                                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                                            <span>{item.month}</span>
                                                            <span>{item.total.toFixed(2)}€</span>
                                                        </div>
                                                        <div className="h-2 rounded bg-slate-100 overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${(item.total / maxMonthly) * 100}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                                {monthlyTotalSeries.length === 0 && <p className="text-sm text-slate-500">Sem dados mensais.</p>}
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl border border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-700 mb-3">Top viaturas por custo</h4>
                                            <div className="space-y-2">
                                                {vehicleCostRows.map((row) => {
                                                    const vehicle = viaturas.find(v => v.id === row.vehicle_id);
                                                    return (
                                                        <div key={row.vehicle_id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                                                            <span className="text-slate-700 font-medium">{vehicle?.matricula || row.vehicle_id}</span>
                                                            <span className="font-bold text-slate-900">{row.total_vehicle_cost.toFixed(2)}€</span>
                                                        </div>
                                                    );
                                                })}
                                                {vehicleCostRows.length === 0 && <p className="text-sm text-slate-500">Sem custos por viatura.</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 text-sm">
                                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                                            <p className="text-xs text-amber-700 uppercase">Seguros</p>
                                            <p className="font-bold text-amber-900">{(financialDashboard?.total_insurance_cost || 0).toFixed(2)}€</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                            <p className="text-xs text-emerald-700 uppercase">IUC</p>
                                            <p className="font-bold text-emerald-900">{(financialDashboard?.total_iuc_cost || 0).toFixed(2)}€</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                                            <p className="text-xs text-blue-700 uppercase">Portagens</p>
                                            <p className="font-bold text-blue-900">{(financialDashboard?.total_tolls_cost || 0).toFixed(2)}€</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
                                            <p className="text-xs text-violet-700 uppercase">Outros</p>
                                            <p className="font-bold text-violet-900">{(financialDashboard?.total_other_costs || 0).toFixed(2)}€</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Alerts Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="surface-card p-6">
                                        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            Alertas de Manutenção
                                        </h3>
                                        {stats.maintenance > 0 ? (
                                            <div className="space-y-3">
                                                {viaturas.filter(v => getVehicleStatus(v) === 'maintenance').map(v => (
                                                    <div key={v.id} className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl hover:bg-amber-500/10 transition-colors cursor-pointer" onClick={() => navigate(`/vehicles/${v.id}`)}>
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                                                <Car className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900">{v.matricula}</p>
                                                                <p className="text-sm text-slate-500">{v.marca} {v.modelo}</p>
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
                                    <div className="surface-card p-6 flex flex-col justify-center">
                                        <h3 className="text-base font-bold text-slate-800 mb-6">Ações Rápidas</h3>
                                        <div className="space-y-4">
                                            <button onClick={() => setActiveTab('create')} className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl transition-all group shadow-sm">
                                                <span className="flex items-center gap-3 font-medium">
                                                    <PlusCircle className="w-5 h-5" />
                                                    Adicionar Nova Viatura
                                                </span>
                                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                            <button onClick={() => setActiveTab('list')} className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl transition-all group shadow-sm">
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
                                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-sm">
                                    <div className="relative w-full md:w-96">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                        <input
                                            type="text"
                                            placeholder="Pesquisar por matrícula, marca ou modelo..."
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-700 placeholder:text-slate-400"
                                            value={filter}
                                            onChange={e => setFilter(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors">
                                            <Filter className="w-4 h-4" />
                                            Filtros
                                        </button>
                                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                                        <span className="text-sm text-slate-400 font-medium">
                                            Showing {filteredItems.length} results
                                        </span>
                                    </div>
                                </div>

                                <div className="android-native-vehicles-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                    {filteredItems.map(viatura => {
                                        const status = getVehicleStatus(viatura);
                                        return (
                                            <div
                                                key={viatura.id}
                                                onClick={() => navigate(`/vehicles/${viatura.id}`)}
                                                className="bg-white/90 border border-slate-200/70 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-visible"
                                            >
                                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteViatura(viatura.id); }}
                                                        className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl transition-colors shadow-sm"
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
                                                            <h3 className="font-bold text-slate-900 text-lg tracking-wide">{viatura.matricula}</h3>
                                                            <p className="text-sm text-slate-500">{viatura.marca} {viatura.modelo}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-slate-100">
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
                                                        <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-500 italic line-clamp-1 flex items-start gap-2">
                                                            <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
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
                            <div className="w-full animate-in slide-in-from-bottom-8 duration-500">
                                <div className="surface-card p-8 rounded-3xl relative overflow-visible">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                    <div className="flex items-center gap-6 mb-8 relative z-10">
                                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                                            <PlusCircle className="w-8 h-8 text-slate-900" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-[#1f2957] mb-1">Nova Viatura</h2>
                                            <p className="text-slate-500">Preencha os dados abaixo para adicionar um novo veículo à frota.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Matrícula</label>
                                                    <input
                                                        required
                                                        maxLength={8}
                                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 text-lg font-mono tracking-widest uppercase placeholder:text-slate-300 transition-all"
                                                        value={formData.matricula}
                                                        onChange={e => setFormData({ ...formData, matricula: e.target.value.toUpperCase() })}
                                                        placeholder="AA-00-BB"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ano</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all"
                                                        value={formData.ano}
                                                        onChange={e => setFormData({ ...formData, ano: e.target.value })}
                                                        placeholder="Ex: 2023"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Marca</label>
                                                    <input
                                                        required
                                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all"
                                                        value={formData.marca}
                                                        onChange={e => setFormData({ ...formData, marca: e.target.value })}
                                                        placeholder="Ex: Mercedes-Benz"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Modelo</label>
                                                    <input
                                                        required
                                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all"
                                                        value={formData.modelo}
                                                        onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                                                        placeholder="Ex: Sprinter"
                                                    />
                                                </div>
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Observações</label>
                                                <textarea
                                                    rows={4}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all resize-none placeholder:text-slate-300"
                                                    value={formData.obs}
                                                    onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                                    placeholder="Informações adicionais, estado da viatura, etc..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('list')}
                                                className="px-6 py-3 text-slate-400 hover:text-slate-900 font-bold transition-colors"
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
