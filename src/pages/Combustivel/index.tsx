import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Fuel, Droplets, History, Check, Truck,
    Gauge, Trash2, LayoutTemplate, BarChart3, Edit, X,
    Upload, Download, FileSpreadsheet, FileText,
    AlertCircle, Plus, TrendingUp, TrendingDown, Zap, Car, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseBPInvoicePDF } from '../../utils/parseBPInvoicePDF';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { excelDateToJSDate } from '../../utils/format';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '../../components/common/PageHeader';

export default function Combustivel() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        fuelTank, fuelTransactions, tankRefills, registerRefuel, motoristas, viaturas, registerTankRefill, deleteFuelTransaction, deleteTankRefill, centrosCustos, updateFuelTank, vehicleMetrics, recalculateFuelTank, updateFuelTransaction
    } = useWorkshop();
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

    const resolveTabFromSearch = () => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab === 'abastecer' || tab === 'tanque' || tab === 'historico' || tab === 'bp' || tab === 'relatorios') {
            return tab;
        }
        return 'overview';
    };

    const [activeTab, setActiveTab] = useState<'overview' | 'abastecer' | 'tanque' | 'historico' | 'bp' | 'relatorios'>(resolveTabFromSearch);
    const [bpTransactions, setBpTransactions] = useState<any[]>([]); // Temp state for BP imports
    const [selectedRows, setSelectedRows] = useState<number[]>([]); // For bulk actions
    const [bulkCC, setBulkCC] = useState('');
    const [selectedViaturaId, setSelectedViaturaId] = useState<string>('');
    const [fuelSourceFilter, setFuelSourceFilter] = useState<'all' | 'internal' | 'external'>('all');
    const [trendRange, setTrendRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [reportTrendRange, setReportTrendRange] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
    const [filters, setFilters] = useState({
        vehicleId: '',
        driverId: '',
        centroCustoId: '',
        startDate: '',
        endDate: ''
    });
    const [isManualBPOpen, setIsManualBPOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setActiveTab(resolveTabFromSearch());
    }, [location.search]);

    const formatDateTime = (value?: string | null) => {
        if (!value) {
            return { date: '-', time: '--:--' };
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return { date: '-', time: '--:--' };
        }

        return {
            date: parsed.toLocaleDateString('pt-PT'),
            time: parsed.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
        };
    };

    // Fuel Form State
    const [refuelForm, setRefuelForm] = useState({
        driverId: '',
        vehicleId: '',
        liters: '',
        km: '',
        centroCustoId: '',
        notes: '',
        manualDate: new Date().toISOString().split('T')[0],
        manualTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
    });

    // Tank Supply Form State
    const [supplyForm, setSupplyForm] = useState({
        supplier: '',
        litersAdded: '',
        pumpReading: '',
        pumpCorrection: '',
        pricePerLiter: '',
        manualDate: new Date().toISOString().split('T')[0],
        manualTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
    });

    // --- Driver Status Check ---
    const getDriverDayOffStatus = (driverId: string) => {
        const driver = motoristas.find(m => m.id === driverId);
        if (!driver) return null;

        const today = new Date();
        const dayOfWeek = today.toLocaleString('pt-PT', { weekday: 'long' });
        const normalizedDay = dayOfWeek.split('-')[0].charAt(0).toUpperCase() + dayOfWeek.split('-')[0].slice(1);

        // Check for approved absences
        const activeAbsence = driver.ausencias?.find((a: any) => {
            const start = new Date(a.inicio);
            const end = new Date(a.fim);
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            return todayDate >= startDate && todayDate <= endDate && a.aprovado;
        });

        if (activeAbsence) {
            return { type: activeAbsence.tipo, label: t(`drivers.status.${activeAbsence.tipo === 'ferias' ? 'holidays' : activeAbsence.tipo === 'baixa' ? 'sick' : 'off'}`) };
        }

        // Check for scheduled weekly days off
        if (driver.folgas?.includes(normalizedDay)) {
            return { type: 'folga', label: t('drivers.status.off') };
        }

        return null;
    };

    const [isEditingTank, setIsEditingTank] = useState(false);
    const [editTankForm, setEditTankForm] = useState({
        capacity: '',
        currentLevel: '',
        averagePrice: '',
        pumpTotalizer: '',
        baselineDate: '',
        baselineLevel: '',
        baselineTotalizer: ''
    });

    const saveTankChanges = (e: React.FormEvent) => {
        e.preventDefault();
        const newCapacity = Number(editTankForm.capacity);
        const newLevel = Number(editTankForm.currentLevel);
        const newPrice = Number(editTankForm.averagePrice);

        if (isNaN(newCapacity) || isNaN(newLevel) || isNaN(newPrice)) {
            alert('Por favor insira valores válidos.');
            return;
        }

        updateFuelTank({
            ...fuelTank,
            capacity: newCapacity,
            currentLevel: newLevel,
            averagePrice: newPrice,
            pumpTotalizer: editTankForm.pumpTotalizer ? Number(editTankForm.pumpTotalizer) : fuelTank.pumpTotalizer,
            baselineDate: editTankForm.baselineDate || fuelTank.baselineDate,
            baselineLevel: editTankForm.baselineLevel ? Number(editTankForm.baselineLevel) : fuelTank.baselineLevel
        });

        setIsEditingTank(false);
        alert('Dados do tanque atualizados com sucesso!');
    };

    // Manual BP Entry State
    const [manualBPForm, setManualBPForm] = useState({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        licensePlate: '',
        liters: '',
        pricePerLiter: '',
        totalCost: '',
        station: '',
        centroCustoId: ''
    });

    const handleManualBPAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const liters = parseFloat(manualBPForm.liters);
        const price = parseFloat(manualBPForm.pricePerLiter);
        const total = parseFloat(manualBPForm.totalCost);

        const newRow = {
            'Data': undefined, // Will use manual date
            'Hora': manualBPForm.time,
            'Matrícula': manualBPForm.licensePlate.toUpperCase(),
            'Litros': liters,
            'Preço Unitário': price,
            'Total': total,
            'Posto': manualBPForm.station,
            'Centro de Custo': '', // Manual entry uses explicit ID below
            _selectedCC: manualBPForm.centroCustoId,
            _manualDate: manualBPForm.date // Helper for rendering
        };

        setBpTransactions(prev => [...prev, newRow]);
        setIsManualBPOpen(false);
        // Reset form but keep date/time/price for convenience? No, unsafe. Reset all.
        setManualBPForm({
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].slice(0, 5),
            licensePlate: '',
            liters: '',
            pricePerLiter: '',
            totalCost: '',
            station: '',
            centroCustoId: ''
        });
    };

    const handleInitiateRefuel = (e: React.FormEvent) => {
        e.preventDefault();
        void confirmRefuel();
    };


    const confirmRefuel = async () => {
        const liters = Number(refuelForm.liters);
        if (!refuelForm.manualDate || !refuelForm.manualTime) {
            alert('Indique Data e Hora do abastecimento.');
            return;
        }

        const refuelDate = new Date(`${refuelForm.manualDate}T${refuelForm.manualTime}`);
        if (Number.isNaN(refuelDate.getTime())) {
            alert('Data/Hora inválidas.');
            return;
        }

        const isAfterBaseline = !fuelTank.baselineDate || refuelDate >= new Date(fuelTank.baselineDate);

        if (isAfterBaseline && liters > fuelTank.currentLevel) {
            alert('Combustível insuficiente no tanque!');
            return;
        }

        // --- Day-off Alert Check ---
        const dayOffStatus = getDriverDayOffStatus(refuelForm.driverId);
        if (dayOffStatus) {
            const proceed = confirm(`AVISO: Este motorista está marcado como [${dayOffStatus.label.toUpperCase()}]. Deseja prosseguir com o abastecimento mesmo assim?`);
            if (!proceed) return;
        }

        if (refuelWarnings.length > 0) {
            const warningSummary = refuelWarnings.map(w => `- (${w.severity.toUpperCase()}) ${w.message}`).join('\n');
            const proceedWarnings = confirm(`Foram detetadas validações importantes:\n\n${warningSummary}\n\nDeseja continuar?`);
            if (!proceedWarnings) return;
        }

        try {
            const isConfirmed = true;
            const payload: any = {
                id: crypto.randomUUID(),
                driverId: refuelForm.driverId || 'manual',
                vehicleId: refuelForm.vehicleId,
                liters: liters,
                km: Number(refuelForm.km),
                centroCustoId: refuelForm.centroCustoId || undefined,
                status: isConfirmed ? 'confirmed' : 'pending',
                timestamp: refuelDate.toISOString(),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Admin'
            };

            if (refuelForm.notes.trim()) {
                payload.notes = refuelForm.notes.trim();
            }

            await registerRefuel(payload);

            setRefuelForm({
                driverId: '',
                vehicleId: '',
                liters: '',
                km: '',
                centroCustoId: '',
                notes: '',
                manualDate: new Date().toISOString().split('T')[0],
                manualTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
            });
            alert('Abastecimento registado com sucesso!');
            setActiveTab('overview');
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao registar abastecimento: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleRegisterSupply = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const added = Number(supplyForm.litersAdded);
            const rawTotal = fuelTank.currentLevel + added;
            const LIMIT = 6000;
            let levelAfter = rawTotal;
            const correction = Number(supplyForm.pumpCorrection || 0);
            const rawPumpReading = supplyForm.pumpReading ? Number(supplyForm.pumpReading) : 0;
            const correctedPumpReading = rawPumpReading + correction;

            if (rawTotal > LIMIT) {
                const overage = rawTotal - LIMIT;
                const proceed = confirm(`ALERTA DE CAPACIDADE!\nVolume total: ${rawTotal.toFixed(1)} L\nLimite Tanque: ${LIMIT} L\nExcesso: ${overage.toFixed(1)} L\n\nO nível do tanque será fixado em ${LIMIT} L. Deseja prosseguir?`);
                if (!proceed) return;
                levelAfter = LIMIT;
            }

            const refillDate = (supplyForm.manualDate && supplyForm.manualTime)
                ? new Date(`${supplyForm.manualDate}T${supplyForm.manualTime}`)
                : new Date();

            await registerTankRefill({
                id: crypto.randomUUID(),
                supplier: supplyForm.supplier,
                litersAdded: added,
                pumpMeterReading: correctedPumpReading,
                pricePerLiter: Number(supplyForm.pricePerLiter),
                levelBefore: fuelTank.currentLevel,
                levelAfter: levelAfter,
                totalSpentSinceLast: 0,
                timestamp: refillDate.toISOString(),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Admin',
                systemExpectedReading: fuelTank.pumpTotalizer,
                totalCost: added * Number(supplyForm.pricePerLiter)
            });
            setSupplyForm({
                supplier: '',
                litersAdded: '',
                pumpReading: '',
                pumpCorrection: '',
                pricePerLiter: '',
                manualDate: new Date().toISOString().split('T')[0],
                manualTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
            });
            alert('Entrada de combustível registada com sucesso!');
            setActiveTab('overview');
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao registar entrada: ${error.message || 'Erro desconhecido'}`);
        }
    };

    // Calculate percentage for tank visual
    const percentage = Math.min(100, Math.max(0, (fuelTank.currentLevel / fuelTank.capacity) * 100));

    const confirmedTransactions = fuelTransactions.filter(tx => tx.status === 'confirmed');
    const now = new Date();

    const getDateKey = (date: Date, mode: 'daily' | 'weekly' | 'monthly') => {
        if (mode === 'monthly') {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (mode === 'weekly') {
            const day = date.getDay() || 7;
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - day + 1);
            return `${weekStart.getFullYear()}-W${String(Math.ceil(((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`;
        }

        return date.toISOString().split('T')[0];
    };

    const overviewTransactions = confirmedTransactions.filter(tx => {
        const txDate = new Date(tx.timestamp);
        if (Number.isNaN(txDate.getTime())) return false;

        if (selectedViaturaId && tx.vehicleId !== selectedViaturaId) return false;
        if (filters.driverId && tx.driverId !== filters.driverId) return false;

        if (filters.startDate) {
            const start = new Date(`${filters.startDate}T00:00:00`);
            if (txDate < start) return false;
        }

        if (filters.endDate) {
            const end = new Date(`${filters.endDate}T23:59:59`);
            if (txDate > end) return false;
        }

        if (fuelSourceFilter === 'internal' && tx.isExternal) return false;
        if (fuelSourceFilter === 'external' && !tx.isExternal) return false;

        return true;
    });

    const todayTransactions = overviewTransactions.filter(tx => {
        const d = new Date(tx.timestamp);
        return d.toDateString() === now.toDateString();
    });

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayTransactions = overviewTransactions.filter(tx => {
        const d = new Date(tx.timestamp);
        return d.toDateString() === yesterday.toDateString();
    });

    const monthTransactions = overviewTransactions.filter(tx => {
        const d = new Date(tx.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthTransactions = overviewTransactions.filter(tx => {
        const d = new Date(tx.timestamp);
        return d.getMonth() === previousMonth.getMonth() && d.getFullYear() === previousMonth.getFullYear();
    });

    const totalTodayLiters = todayTransactions.reduce((sum, tx) => sum + Number(tx.liters || 0), 0);
    const totalYesterdayLiters = yesterdayTransactions.reduce((sum, tx) => sum + Number(tx.liters || 0), 0);
    const totalMonthLiters = monthTransactions.reduce((sum, tx) => sum + Number(tx.liters || 0), 0);
    const totalPreviousMonthLiters = previousMonthTransactions.reduce((sum, tx) => sum + Number(tx.liters || 0), 0);
    const totalOverviewLiters = overviewTransactions.reduce((sum, tx) => sum + Number(tx.liters || 0), 0);
    const totalOverviewCost = overviewTransactions.reduce((sum, tx) => sum + Number(tx.totalCost || 0), 0);
    const avgPrice = totalOverviewLiters > 0 ? totalOverviewCost / totalOverviewLiters : Number(fuelTank.averagePrice || 0);

    const recent30Days = overviewTransactions.filter(tx => {
        const d = new Date(tx.timestamp);
        const diffDays = (now.getTime() - d.getTime()) / 86400000;
        return diffDays <= 30;
    });
    const avgDailyConsumption = recent30Days.length > 0 ? recent30Days.reduce((sum, tx) => sum + Number(tx.liters || 0), 0) / 30 : 0;

    const minimumLevel = fuelTank.capacity * 0.2;
    const litersUntilMinimum = Math.max(0, fuelTank.currentLevel - minimumLevel);
    const autonomyDays = avgDailyConsumption > 0 ? fuelTank.currentLevel / avgDailyConsumption : 0;
    const daysToMinimum = avgDailyConsumption > 0 ? litersUntilMinimum / avgDailyConsumption : 0;

    const tankLevelState = percentage <= 20 ? 'critical' : percentage <= 40 ? 'warning' : 'normal';
    const tankLevelColor = tankLevelState === 'critical' ? 'bg-red-500' : tankLevelState === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';

    const vehicleConsumptionRows = viaturas.map(v => {
        const txs = overviewTransactions.filter(tx => tx.vehicleId === v.id);
        const liters = txs.reduce((sum, tx) => sum + Number(tx.liters || 0), 0);
        const avgConsumption = txs.length > 0
            ? txs.reduce((sum, tx) => sum + Number(tx.consumoCalculado || 0), 0) / txs.filter(tx => Number(tx.consumoCalculado || 0) > 0).length || 0
            : 0;

        return {
            vehicleId: v.id,
            matricula: v.matricula,
            liters,
            avgConsumption
        };
    }).filter(row => row.liters > 0 || row.avgConsumption > 0);

    const topConsumptionVehicles = [...vehicleConsumptionRows].sort((a, b) => b.liters - a.liters).slice(0, 5);
    const lowestConsumptionVehicles = [...vehicleConsumptionRows].sort((a, b) => a.liters - b.liters).slice(0, 5);
    const efficiencyRanking = [...vehicleConsumptionRows]
        .filter(row => row.avgConsumption > 0)
        .sort((a, b) => a.avgConsumption - b.avgConsumption)
        .slice(0, 5);

    const trendBuckets = new Map<string, number>();
    overviewTransactions.forEach(tx => {
        const date = new Date(tx.timestamp);
        const key = getDateKey(date, trendRange);
        trendBuckets.set(key, (trendBuckets.get(key) || 0) + Number(tx.liters || 0));
    });
    const trendSeries = [...trendBuckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([label, value]) => ({ label, value }));

    const trendMax = Math.max(...trendSeries.map(p => p.value), 1);
    const trendPoints = trendSeries.map((point, index) => {
        const x = trendSeries.length === 1 ? 0 : (index / (trendSeries.length - 1)) * 100;
        const y = 100 - (point.value / trendMax) * 100;
        return `${x},${y}`;
    }).join(' ');

    const lastPumpActivity = [...confirmedTransactions]
        .filter(tx => !tx.isExternal)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const pumpToday = confirmedTransactions
        .filter(tx => !tx.isExternal)
        .filter(tx => new Date(tx.timestamp).toDateString() === now.toDateString())
        .reduce((sum, tx) => sum + Number(tx.liters || 0), 0);

    const pumpHealthStatus = fuelTank.currentLevel < minimumLevel
        ? 'Atenção necessária'
        : fuelTank.currentLevel < fuelTank.capacity * 0.4
            ? 'Monitorizar'
            : 'Saudável';

    const latestRefill = [...tankRefills].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const dashboardAlerts = [
        fuelTank.currentLevel < fuelTank.capacity * 0.25
            ? {
                severity: 'high',
                title: 'Baixo stock do depósito',
                description: `Nível atual em ${percentage.toFixed(1)}% (${fuelTank.currentLevel.toFixed(1)}L).`,
                timestamp: new Date().toISOString()
            }
            : null,
        ...overviewTransactions
            .filter(tx => Number(tx.consumoCalculado || 0) >= 14)
            .slice(0, 2)
            .map(tx => ({
                severity: 'medium',
                title: 'Pico de consumo detectado',
                description: `${(viaturas.find(v => v.id === tx.vehicleId)?.matricula || tx.vehicleId)} registou ${tx.consumoCalculado} L/100km.`,
                timestamp: tx.timestamp
            })),
        (latestRefill && Number(latestRefill.pumpMeterReading || 0) > 0 && Number(fuelTank.pumpTotalizer || 0) > 0 && Math.abs(Number(latestRefill.pumpMeterReading || 0) - Number(fuelTank.pumpTotalizer || 0)) > 250)
            ? {
                severity: 'medium',
                title: 'Mismatch no contador da bomba',
                description: 'Diferença relevante entre última leitura e totalizador atual.',
                timestamp: latestRefill.timestamp
            }
            : null,
        ...overviewTransactions
            .filter(tx => tx.isAnormal)
            .slice(0, 2)
            .map(tx => ({
                severity: 'high',
                title: 'Uso anormal por viatura',
                description: `${viaturas.find(v => v.id === tx.vehicleId)?.matricula || tx.vehicleId} marcada com anomalia de consumo.`,
                timestamp: tx.timestamp
            }))
    ].filter(Boolean) as Array<{ severity: 'low' | 'medium' | 'high'; title: string; description: string; timestamp: string }>;


    // --- BP Import Logic ---
    const parseImportNumber = (val: any): number => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let normalized = val.trim().replace(/\s/g, '');
            // If comma exists, it's likely the decimal separator (European). Remove dots (thousands) and fix comma.
            if (normalized.includes(',')) {
                normalized = normalized.replace(/\./g, '').replace(',', '.');
            }
            const num = parseFloat(normalized);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    const handleDownloadBPTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                'Dia Hora': '15/01/2026 18:42',
                'Matrícula': '51-NR-36',
                'Km': 449100,
                'Posto': 'VILAMOURA',
                'Produto': 'GASOLEO',
                'Quantidade': 64.77,
                'Valor total a faturar': 99.66
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template BP");
        XLSX.writeFile(wb, "template_importacao_bp.xlsx");
    };

    const handleImportBP = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ── PDF import (BP Mobility invoice) ───────────────────────────
        if (file.name.toLowerCase().endsWith('.pdf')) {
            try {
                const rows = await parseBPInvoicePDF(file);
                if (rows.length === 0) {
                    alert('Nenhuma transação encontrada no PDF. Verifique se é uma fatura BP válida.');
                    return;
                }
                setBpTransactions(rows);
                setSelectedRows([]);
            } catch (err: any) {
                console.error('Erro ao processar PDF BP:', err);
                alert(`Erro ao processar o PDF: ${err?.message ?? 'Erro desconhecido'}`);
            }
            return;
        }

        // ── Excel import (existing behaviour) ──────────────────────────
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);

            // Filter empty rows
            const validData = data.filter(row => {
                const keys = Object.keys(row);
                const hasPlate = keys.some(k => k.trim().toLowerCase() === 'matrícula');
                const hasQty = keys.some(k => k.trim().toLowerCase() === 'quantidade' || k.trim().toLowerCase() === 'litros');
                return hasPlate || hasQty;
            });

            // Normalize and Enrich data
            const enrichedData = validData.map(row => {
                // Better normalization: trim keys and check alternates
                const normalized: any = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = key.trim();
                    const lowerKey = cleanKey.toLowerCase();

                    if (lowerKey === 'dia hora' || lowerKey === 'data') normalized['Dia Hora'] = row[key];
                    else if (lowerKey === 'nº transação' || lowerKey === 'transaçao' || lowerKey === 'transação') normalized['Nº transação'] = row[key];
                    else if (lowerKey === 'nº cartão' || lowerKey === 'cartão' || lowerKey === 'cartao') normalized['Nº cartão'] = row[key];
                    else if (lowerKey === 'proprietário' || lowerKey === 'proprietario') normalized['Proprietário'] = row[key];
                    else if (lowerKey === 'matrícula' || lowerKey === 'matricula') normalized['Matrícula'] = row[key];
                    else if (lowerKey === 'km' || lowerKey === 'kms') normalized['Km'] = row[key];
                    else if (lowerKey === 'dia laboral' || lowerKey === 'laboral') normalized['Dia laboral'] = row[key];
                    else if (lowerKey === 'posto') normalized['Posto'] = row[key];
                    else if (lowerKey === 'produto') normalized['Produto'] = row[key];
                    else if (lowerKey === 'quantidade' || lowerKey === 'litros') normalized['Litros'] = row[key];
                    else if (lowerKey === 'preço' || lowerKey === 'preço unitário') normalized['Preço Unitário'] = row[key];
                    else if (lowerKey === 'valor líquido' || lowerKey === 'liquido') normalized['Valor líquido'] = row[key];
                    else if (lowerKey === 'iva') normalized['IVA'] = row[key];
                    else if (lowerKey === 'valor total a faturar' || lowerKey === 'total' || lowerKey === 'valor total') normalized['Total'] = row[key];
                    else if (lowerKey === 'iva%') normalized['IVA%'] = row[key];
                    else normalized[cleanKey] = row[key];
                });

                const ccName = normalized['Centro de Custo'];
                const matchedCC = centrosCustos.find(c => c.nome.toLowerCase() === ccName?.toLowerCase());

                return {
                    ...normalized,
                    _selectedCC: matchedCC ? matchedCC.id : ''
                };
            });

            setBpTransactions(enrichedData);
            setSelectedRows([]);
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmBPImport = async () => {
        if (selectedRows.length === 0) {
            alert('Selecione pelo menos um registo para importar.');
            return;
        }

        const rowsToImport = selectedRows.map((idx: number) => bpTransactions[idx]).filter(Boolean);

        if (rowsToImport.length === 0) {
            alert('Não existem linhas para importar.');
            return;
        }

        if (!confirm(`Confirma a importação de ${rowsToImport.length} registos selecionados?`)) return;

        let successCount = 0;
        let errorCount = 0;

        for (const row of rowsToImport as any[]) {
            try {
                // Find Vehicle (Fuzzy Match: Remove spaces, dashes, case insensitive)
                const normalizePlate = (p: string) => p?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                const plate = row['Matrícula'];
                const cleanPlate = normalizePlate(plate);
                const vehicle = viaturas.find(v => normalizePlate(v.matricula) === cleanPlate);

                // Use manually selected Centro de Custo
                const ccId = row._selectedCC;

                // Parse Date & Time
                let timestamp = new Date().toISOString();

                // Optimized parsing using the improved helper
                const diaHora = row['Dia Hora'];
                const dataVal = row['Data'];
                const horaVal = row['Hora'];
                let dateObj: Date | null = null;

                if (row._manualDate) {
                    dateObj = new Date(row._manualDate);
                    const h = excelDateToJSDate(horaVal);
                    if (h && dateObj) dateObj.setHours(h.getHours(), h.getMinutes());
                } else {
                    const primaryDate = diaHora || dataVal;
                    if (primaryDate) {
                        dateObj = excelDateToJSDate(primaryDate);
                        // If it's a separate date column often time is in another column
                        if (dateObj && horaVal) {
                            const h = excelDateToJSDate(horaVal);
                            if (h) dateObj.setHours(h.getHours(), h.getMinutes());
                        }
                    }
                }

                if (dateObj && !isNaN(dateObj.getTime())) {
                    timestamp = dateObj.toISOString();
                }

                // Prepare Transaction
                const liters = parseImportNumber(row['Litros']);
                const totalCost = parseImportNumber(row['Total']);
                const pricePerLiter = liters > 0 ? totalCost / liters : 0;

                const transaction: any = {
                    id: crypto.randomUUID(),
                    vehicleId: vehicle ? vehicle.id : (cleanPlate || 'UNKNOWN_PLATE'),
                    driverId: null,
                    liters: liters,
                    pricePerLiter: pricePerLiter,
                    totalCost: totalCost,
                    km: parseImportNumber(row['Km']),
                    status: 'confirmed',
                    timestamp: timestamp,
                    staffId: currentUser?.id || 'admin',
                    staffName: currentUser?.nome || 'Admin',
                    centroCustoId: ccId || null,
                    isExternal: true
                };

                await registerRefuel(transaction);
                successCount++;
            } catch (err) {
                console.error("Erro ao importar linha BP:", row, err);
                errorCount++;
            }
        }

        alert(`Importação concluída.\nSucesso: ${successCount}\nErros: ${errorCount}`);

        if (successCount > 0) {
            setBpTransactions([]);
            setSelectedRows([]);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Switch to history tab so user sees the new records immediately
            setActiveTab('historico');
        }
    };

    const internalRefuels = fuelTransactions.filter(tx => !tx.isExternal && tx.status === 'confirmed');
    const totalInternalLiters = internalRefuels.reduce((sum, tx) => sum + tx.liters, 0);
    const totalTankIn = tankRefills.reduce((sum, r) => sum + r.litersAdded, 0);

    const selectedVehicle = viaturas.find(v => v.id === refuelForm.vehicleId);
    const selectedVehicleTxs = fuelTransactions
        .filter(tx => tx.status === 'confirmed' && tx.vehicleId === refuelForm.vehicleId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastVehicleTx = selectedVehicleTxs[0];
    const selectedVehicleMetric = vehicleMetrics.find(m => m.vehicleId === refuelForm.vehicleId);

    const avgVehicleConsumption = Number(selectedVehicleMetric?.consumoMedio ||
        (selectedVehicleTxs.filter(tx => Number(tx.consumoCalculado || 0) > 0).reduce((sum, tx) => sum + Number(tx.consumoCalculado || 0), 0) /
            Math.max(1, selectedVehicleTxs.filter(tx => Number(tx.consumoCalculado || 0) > 0).length)) || 0);

    const enteredKm = Number(refuelForm.km || 0);
    const enteredLiters = Number(refuelForm.liters || 0);
    const lastKm = Number(lastVehicleTx?.km || 0);
    const mileageJump = enteredKm && lastKm ? enteredKm - lastKm : 0;
    const expectedLitersForJump = avgVehicleConsumption > 0 && mileageJump > 0 ? (mileageJump / 100) * avgVehicleConsumption : 0;
    const estimatedAutonomyAfterRefuelKm = avgVehicleConsumption > 0 ? (enteredLiters / avgVehicleConsumption) * 100 : 0;

    const refuelWarnings = [
        mileageJump < 0
            ? { severity: 'high' as const, message: 'Quilometragem inferior ao último registo da viatura.' }
            : null,
        mileageJump > 1200
            ? { severity: 'medium' as const, message: `Salto de quilometragem elevado: +${mileageJump} km.` }
            : null,
        expectedLitersForJump > 0 && enteredLiters > expectedLitersForJump * 1.6
            ? { severity: 'high' as const, message: 'Litros acima do esperado para o percurso informado.' }
            : null,
        enteredLiters > 0 && mileageJump > 0 && (enteredLiters / Math.max(1, mileageJump)) * 100 > Math.max(18, avgVehicleConsumption * 1.7)
            ? { severity: 'medium' as const, message: 'Consumo por percurso fora da faixa esperada.' }
            : null
    ].filter(Boolean) as Array<{ severity: 'high' | 'medium' | 'low'; message: string }>;

    const selectedVehicleMonthlyConsumption = selectedVehicleTxs
        .filter(tx => {
            const d = new Date(tx.timestamp);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, tx) => sum + Number(tx.liters || 0), 0);

    const efficiencyScore = avgVehicleConsumption > 0
        ? Math.max(0, Math.min(100, Math.round(100 - ((avgVehicleConsumption - 6) * 7))))
        : 0;

    const refillAmountPreview = Number(supplyForm.litersAdded || 0);
    const refillPricePreview = Number(supplyForm.pricePerLiter || 0);
    const levelBeforeRefill = fuelTank.currentLevel;
    const levelAfterRefillPreview = Math.min(6000, levelBeforeRefill + refillAmountPreview);
    const refillCostPreview = refillAmountPreview * refillPricePreview;
    const weightedPricePreview = (levelBeforeRefill + refillAmountPreview) > 0
        ? ((levelBeforeRefill * Number(fuelTank.averagePrice || 0)) + (refillAmountPreview * refillPricePreview)) / (levelBeforeRefill + refillAmountPreview)
        : Number(fuelTank.averagePrice || 0);

    const supplierRefills = tankRefills.filter(r => supplyForm.supplier && r.supplier?.toLowerCase().trim() === supplyForm.supplier.toLowerCase().trim());
    const supplierAvgPrice = supplierRefills.length > 0
        ? supplierRefills.reduce((sum, r) => sum + Number(r.pricePerLiter || 0), 0) / supplierRefills.length
        : 0;
    const supplierLastDelivery = supplierRefills[0]?.timestamp;
    const supplierPriceTrend = supplierRefills.length >= 2
        ? Number(supplierRefills[0].pricePerLiter || 0) - Number(supplierRefills[1].pricePerLiter || 0)
        : 0;

    const recentInternal7Days = internalRefuels.filter(tx => {
        const d = new Date(tx.timestamp);
        return (now.getTime() - d.getTime()) / 86400000 <= 7;
    });
    const avgDaily7Days = recentInternal7Days.reduce((sum, tx) => sum + Number(tx.liters || 0), 0) / 7;
    const tankDaysRemaining7d = avgDaily7Days > 0 ? fuelTank.currentLevel / avgDaily7Days : 0;

    const recentRefillsTimeline = [...tankRefills]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

    const discrepancyLiters = totalTankIn - totalInternalLiters;
    const discrepancyRisk = Math.abs(discrepancyLiters) > 250 ? 'high' : Math.abs(discrepancyLiters) > 120 ? 'medium' : 'low';
    const auditConfidence = Math.max(0, Math.min(100, Math.round(100 - ((Math.abs(discrepancyLiters) / Math.max(1, totalTankIn)) * 100))));

    const reportTransactions = confirmedTransactions.filter(tx => {
        const txDate = new Date(tx.timestamp);
        if (Number.isNaN(txDate.getTime())) return false;

        if (filters.startDate) {
            const start = new Date(`${filters.startDate}T00:00:00`);
            if (txDate < start) return false;
        }

        if (filters.endDate) {
            const end = new Date(`${filters.endDate}T23:59:59`);
            if (txDate > end) return false;
        }

        return true;
    });

    const reportModeForKey = reportTrendRange === 'custom' ? 'daily' : reportTrendRange;
    const reportTrendBuckets = new Map<string, number>();
    reportTransactions.forEach(tx => {
        const key = getDateKey(new Date(tx.timestamp), reportModeForKey);
        reportTrendBuckets.set(key, (reportTrendBuckets.get(key) || 0) + Number(tx.liters || 0));
    });
    const reportTrendSeries = [...reportTrendBuckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([label, value]) => ({ label, value }));
    const reportTrendMax = Math.max(...reportTrendSeries.map(item => item.value), 1);
    const reportTrendPoints = reportTrendSeries.map((point, index) => {
        const x = reportTrendSeries.length === 1 ? 0 : (index / (reportTrendSeries.length - 1)) * 100;
        const y = 100 - (point.value / reportTrendMax) * 100;
        return `${x},${y}`;
    }).join(' ');

    const anomalySignals = [
        ...reportTransactions.filter(tx => Number(tx.consumoCalculado || 0) >= 14).slice(0, 4).map(tx => ({
            kind: 'Spike de consumo',
            detail: `${viaturas.find(v => v.id === tx.vehicleId)?.matricula || tx.vehicleId} com ${tx.consumoCalculado} L/100km`,
            timestamp: tx.timestamp
        })),
        ...(Math.abs(discrepancyLiters) > 120 ? [{
            kind: 'Pump mismatch',
            detail: `Diferença acumulada de ${discrepancyLiters.toFixed(1)}L entre entradas e saídas.`,
            timestamp: new Date().toISOString()
        }] : [])
    ];

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const estimatedMonthlyUsage = avgDaily7Days * daysInMonth;
    const estimatedRefillDate = avgDaily7Days > 0
        ? new Date(now.getTime() + (Math.max(0, fuelTank.currentLevel - minimumLevel) / avgDaily7Days) * 86400000)
        : null;
    const costForecast = estimatedMonthlyUsage * avgPrice;

    const exportIntervalsPDF = () => {
        const doc = new jsPDF();
        const sortedRefills = [...tankRefills].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Helper for colors
        const colors = {
            primary: [15, 23, 42],
            secondary: [51, 65, 85],
            accent: [16, 185, 129],
            danger: [220, 38, 38],
            bg: [248, 250, 252]
        };

        // Header Design
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('AUDITORIA DE COMBUSTÍVEL', 14, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 33);
        doc.text(`Capacidade Tanque: ${fuelTank.capacity} L | Nível Atual: ${fuelTank.currentLevel.toFixed(1)} L`, 140, 33);

        let yPos = 50;

        // Process periods
        const intervals = [];
        const latestRefill = sortedRefills[sortedRefills.length - 1];
        const currentPeriodTransactions = fuelTransactions.filter(tx =>
            !tx.isExternal && tx.status === 'confirmed' &&
            (!latestRefill || new Date(tx.timestamp) > new Date(latestRefill.timestamp))
        );

        if (latestRefill || currentPeriodTransactions.length > 0) {
            intervals.push({
                title: 'ESTADO ATUAL (Desde o último reabastecimento)',
                refill: null,
                transactions: currentPeriodTransactions,
                isCurrent: true
            });
        }

        for (let i = sortedRefills.length - 1; i >= 0; i--) {
            const refill = sortedRefills[i];
            const prevRefill = i > 0 ? sortedRefills[i - 1] : null;
            const start = prevRefill ? new Date(prevRefill.timestamp) : new Date(0);
            const end = new Date(refill.timestamp);

            const intervalTxs = fuelTransactions.filter(tx =>
                !tx.isExternal && tx.status === 'confirmed' &&
                new Date(tx.timestamp) > start &&
                new Date(tx.timestamp) <= end
            );

            intervals.push({
                title: `Entrega: ${refill.supplier || 'N/A'}`,
                subtitle: `${new Date(refill.timestamp).toLocaleString()}`,
                refill,
                transactions: intervalTxs,
                isCurrent: false
            });
        }

        intervals.forEach((interval) => {
            if (yPos > 230) {
                doc.addPage();
                yPos = 20;
            }

            // Interval Header
            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos, 182, 12, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.line(14, yPos, 14, yPos + 12);

            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text(interval.title, 18, yPos + 8);

            if (interval.subtitle) {
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.setFont('helvetica', 'normal');
                doc.text(interval.subtitle, 150, yPos + 8);
            }
            yPos += 18;

            // Summary row for the period
            if (interval.refill || interval.isCurrent) {
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                const totalOut = interval.transactions.reduce((s, t) => s + t.liters, 0);
                const costOut = interval.transactions.reduce((s, t) => s + (t.totalCost || 0), 0);

                let summaryText = `Consumo: ${totalOut.toFixed(1)} L | Custo: ${costOut.toFixed(2)} €`;
                if (interval.refill) {
                    summaryText += ` | Entregue: ${interval.refill.litersAdded} L | Nível Final: ${interval.refill.levelAfter} L`;
                    const totalCalc = interval.refill.levelBefore + interval.refill.litersAdded;
                    if (totalCalc > 6000) {
                        doc.setTextColor(220, 38, 38);
                        summaryText += ` | EXCESSO: +${(totalCalc - 6000).toFixed(1)} L`;
                    }
                }
                doc.text(summaryText, 14, yPos);
                yPos += 8;
            }

            const tableData = interval.transactions.map(tx => {
                const viatura = viaturas.find(v => v.id === tx.vehicleId || v.matricula === tx.vehicleId);
                const motorista = motoristas.find(m => m.id === tx.driverId);
                return [
                    new Date(tx.timestamp).toLocaleString(),
                    viatura?.matricula || tx.vehicleId || 'N/A',
                    motorista?.nome || tx.staffName || 'N/A',
                    `${tx.liters.toFixed(1)} L`,
                    `${tx.totalCost?.toFixed(2) || '0.00'} €`
                ];
            });

            autoTable(doc, {
                startY: yPos,
                head: [['Data/Hora', 'Viatura', 'Motorista', 'Litros', 'Custo']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 30, halign: 'center' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 25, halign: 'right' },
                    4: { cellWidth: 25, halign: 'right' }
                },
                styles: { fontSize: 8, cellPadding: 3 },
                margin: { left: 14, right: 14 }
            });

            yPos = (doc as any).lastAutoTable.finalY + 15;
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount}`, 180, 285);
            doc.text('Tropical Inspire - Gestão de Frota e Oficina', 14, 285);
        }

        doc.save(`auditoria_tanque_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await updateFuelTransaction(editingTransaction.id, {
                vehicleId: editingTransaction.vehicleId,
                driverId: editingTransaction.driverId,
                liters: Number(editingTransaction.liters),
                km: Number(editingTransaction.km),
                totalCost: Number(editingTransaction.totalCost),
                timestamp: editingTransaction.timestamp,
                centroCustoId: editingTransaction.centroCustoId
            });
            if (error) throw error;
            setEditingTransaction(null);
            alert('Registo atualizado com sucesso!');
        } catch (err: any) {
            alert('Erro ao atualizar: ' + err.message);
        }
    };

    const exportAuditReport = () => {
        // 1. Prepare Tank Refills Data
        const refillData = tankRefills.map(r => ({
            'Data': new Date(r.timestamp).toLocaleString(),
            'Fornecedor': r.supplier || 'N/A',
            'Litros Adicionados': r.litersAdded,
            'Nível Antes': r.levelBefore,
            'Nível Depois': r.levelAfter,
            'Preço/Litro': r.pricePerLiter,
            'Custo Total': r.totalCost,
            'Leitura Bomba': r.pumpMeterReading
        }));

        // 2. Prepare Consumption Data (Only Internal)
        const consumptionData = fuelTransactions
            .filter(tx => !tx.isExternal && tx.status === 'confirmed')
            .map(tx => {
                const vehicle = viaturas.find(v => v.id === tx.vehicleId);
                const cc = centrosCustos.find(c => c.id === tx.centroCustoId);
                return {
                    'Data': new Date(tx.timestamp).toLocaleString(),
                    'Viatura': vehicle?.matricula || tx.vehicleId,
                    'Litros': tx.liters,
                    'Custo': tx.totalCost,
                    'Centro de Custo': cc?.nome || 'N/A'
                };
            });

        // 3. Totals Summary
        const totalIn = tankRefills.reduce((sum, r) => sum + r.litersAdded, 0);
        const totalOut = fuelTransactions.filter(tx => !tx.isExternal && tx.status === 'confirmed').reduce((sum, tx) => sum + tx.liters, 0);

        const summary = [
            { 'Métrica': 'Total Entradas (Tanque)', 'Valor': totalIn },
            { 'Métrica': 'Total Saídas (Abastecimentos)', 'Valor': totalOut },
            { 'Métrica': 'Diferença Acumulada', 'Valor': totalIn - totalOut },
            { 'Métrica': 'Nível Atual Sistema', 'Valor': fuelTank.currentLevel }
        ];

        // Create Workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Resumo");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(refillData), "Entradas Tanque");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consumptionData), "Saídas Oficina");

        XLSX.writeFile(wb, `Relatorio_Auditoria_Combustivel_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportWorkshopRefuelSheetPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - margin * 2;
        const generatedAt = new Date();
        const headerBoxY = 28;
        const headerBoxHeight = 28;
        const tableStartY = 62;
        const rowHeight = 11;
        const rowsPerPage = 10;
        const tableHeaderHeight = 10;
        const footerY = pageHeight - 18;
        const columns = [
            { header: 'Data', width: 18 },
            { header: 'Hora', width: 14 },
            { header: 'Motorista', width: 40 },
            { header: 'Oficina', width: 28 },
            { header: 'Viatura', width: 18 },
            { header: 'KM', width: 18 },
            { header: 'Litros', width: 18 },
            { header: 'Centro Custo', width: 27 },
            { header: 'Ass. Motorista', width: 46 },
            { header: 'Ass. Oficina', width: 46 }
        ];

        const drawHeader = (pageNumber: number) => {
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 24, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(255, 255, 255);
            doc.text('REGISTO DE ABASTECIMENTOS', margin, 11);

            doc.setFontSize(11);
            doc.text('Tanque da Oficina', margin, 18);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            doc.text(`Gerado em ${generatedAt.toLocaleDateString('pt-PT')} ${generatedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 11, { align: 'right' });
            doc.text(`Página ${pageNumber}`, pageWidth - margin, 18, { align: 'right' });

            doc.setTextColor(15, 23, 42);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin, headerBoxY, contentWidth, headerBoxHeight, 2, 2, 'FD');

            const blockGap = 6;
            const blockWidth = (contentWidth - blockGap * 2 - 12) / 3;
            const blockX1 = margin + 4;
            const blockX2 = blockX1 + blockWidth + blockGap;
            const blockX3 = blockX2 + blockWidth + blockGap;
            const titleY = headerBoxY + 7;
            const textY = headerBoxY + 13;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('Objetivo', blockX1, titleY);
            doc.text('Validação', blockX2, titleY);
            doc.text('Notas', blockX3, titleY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text(doc.splitTextToSize('Registo manual dos abastecimentos efetuados no tanque da oficina.', blockWidth), blockX1, textY);
            doc.text(doc.splitTextToSize('Cada linha deve ser validada pelo motorista e pelo colaborador da oficina.', blockWidth), blockX2, textY);
            doc.text(doc.splitTextToSize('Use uma folha por período, por viatura ou por turno, conforme o controlo interno.', blockWidth), blockX3, textY);
        };

        const drawTable = (startY: number) => {
            let x = margin;

            doc.setFillColor(241, 245, 249);
            doc.rect(margin, startY, contentWidth, tableHeaderHeight, 'F');
            // Keep table borders high-contrast for printed copies.
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.25);
            doc.rect(margin, startY, contentWidth, tableHeaderHeight);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(15, 23, 42);

            columns.forEach((column) => {
                doc.rect(x, startY, column.width, tableHeaderHeight);
                doc.text(doc.splitTextToSize(column.header, column.width - 3), x + column.width / 2, startY + 6, { align: 'center' });
                x += column.width;
            });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);

            for (let row = 0; row < rowsPerPage; row++) {
                const y = startY + tableHeaderHeight + row * rowHeight;
                let rowX = margin;

                columns.forEach((column) => {
                    doc.rect(rowX, y, column.width, rowHeight);
                    rowX += column.width;
                });
            }

            // Restore default line width for non-table shapes.
            doc.setLineWidth(0.2);
        };

        const drawFooter = () => {
            doc.setDrawColor(226, 232, 240);
            doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text('Resumo do período:', margin, footerY - 2);
            doc.text('Responsável da oficina:', 104, footerY - 2);
            doc.text('Observações:', 182, footerY - 2);

            doc.setDrawColor(148, 163, 184);
            doc.line(margin + 30, footerY - 2, 96, footerY - 2);
            doc.line(136, footerY - 2, 176, footerY - 2);
            doc.line(204, footerY - 2, pageWidth - margin, footerY - 2);
        };

        for (let page = 1; page <= 2; page++) {
            if (page > 1) doc.addPage();
            drawHeader(page);
            drawTable(tableStartY);
            drawFooter();
        }

        doc.save(`folha_registo_abastecimentos_oficina_${generatedAt.toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="combustivel-page android-native-fuel w-full min-w-0 space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title={t('fuel.title')}
                subtitle={t('fuel.subtitle')}
                icon={Fuel}
            >
                <div className="combustivel-tabs flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 backdrop-blur-md shadow-lg overflow-x-auto max-w-full scrollbar-none">
                    {[
                        { id: 'overview', icon: LayoutTemplate, label: 'Geral' },
                        { id: 'abastecer', icon: Fuel, label: 'Abastecer' },
                        { id: 'tanque', icon: Droplets, label: 'Tanque' },
                        { id: 'historico', icon: History, label: 'Histórico' },
                        { id: 'bp', icon: FileSpreadsheet, label: 'BP' },
                        { id: 'relatorios', icon: BarChart3, label: 'Relatórios' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-3 md:px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap text-sm
                            ${activeTab === tab.id
                                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </PageHeader>

            <div className="p-3 md:p-8 space-y-5 md:space-y-8">

                {/* Content Area */}

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="surface-card p-5 sm:p-6 lg:p-8 space-y-6">
                            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Combustível</h2>
                                    <p className="text-slate-500 font-medium">Painel operacional para consumo, stock e eficiência</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                                    <div className="relative">
                                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <select
                                            value={selectedViaturaId}
                                            onChange={(e) => setSelectedViaturaId(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-3 text-base md:text-sm text-slate-700 focus:border-blue-400 outline-none"
                                        >
                                            <option value="">Todas as viaturas</option>
                                            {viaturas.map(v => (
                                                <option key={v.id} value={v.id}>{v.matricula}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <select
                                        value={filters.driverId}
                                        onChange={(e) => setFilters(prev => ({ ...prev, driverId: e.target.value }))}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-base md:text-sm text-slate-700 focus:border-blue-400 outline-none"
                                    >
                                        <option value="">Todos os motoristas</option>
                                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                    </select>

                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-base md:text-sm text-slate-700 focus:border-blue-400 outline-none"
                                    />

                                    <select
                                        value={fuelSourceFilter}
                                        onChange={(e) => setFuelSourceFilter(e.target.value as any)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-base md:text-sm text-slate-700 focus:border-blue-400 outline-none"
                                    >
                                        <option value="all">Fonte: todas</option>
                                        <option value="internal">Fonte: tanque interno</option>
                                        <option value="external">Fonte: externa</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                                <div className="surface-card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Nível atual do tanque</span>
                                        <Droplets className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-900">{fuelTank.currentLevel.toFixed(1)}L</p>
                                    <p className="text-xs text-slate-500">{percentage.toFixed(1)}% da capacidade</p>
                                    <p className={`text-xs mt-2 font-semibold ${totalTodayLiters >= totalYesterdayLiters ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {totalTodayLiters >= totalYesterdayLiters ? <TrendingUp className="inline w-3 h-3 mr-1" /> : <TrendingDown className="inline w-3 h-3 mr-1" />}
                                        Hoje vs ontem: {totalTodayLiters.toFixed(1)}L / {totalYesterdayLiters.toFixed(1)}L
                                    </p>
                                </div>

                                <div className="surface-card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Preço médio €/L</span>
                                        <BarChart3 className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-900">{avgPrice.toFixed(3)}€</p>
                                    <p className="text-xs text-slate-500">Referência PMP calculada</p>
                                </div>

                                <div className="surface-card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Consumo hoje</span>
                                        <Fuel className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-900">{totalTodayLiters.toFixed(1)}L</p>
                                    <p className="text-xs text-slate-500">{todayTransactions.length} registos</p>
                                </div>

                                <div className="surface-card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Consumo mês</span>
                                        <History className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-900">{totalMonthLiters.toFixed(1)}L</p>
                                    <p className={`text-xs font-semibold ${totalMonthLiters >= totalPreviousMonthLiters ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {totalMonthLiters >= totalPreviousMonthLiters ? '+' : ''}{(totalMonthLiters - totalPreviousMonthLiters).toFixed(1)}L vs mês anterior
                                    </p>
                                </div>

                                <div className="surface-card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Autonomia estimada</span>
                                        <Zap className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-900">{autonomyDays > 0 ? `${autonomyDays.toFixed(1)} dias` : '--'}</p>
                                    <p className="text-xs text-slate-500">Min. nível em {daysToMinimum > 0 ? `${daysToMinimum.toFixed(1)} dias` : '--'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <div className="xl:col-span-2 space-y-6">
                                    <div className="surface-card p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-black text-slate-900">Visual do Tanque</h3>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tankLevelState === 'critical' ? 'bg-red-100 text-red-700' : tankLevelState === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {tankLevelState === 'critical' ? 'Crítico' : tankLevelState === 'warning' ? 'Atenção' : 'Normal'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                            <div className="md:col-span-2">
                                                <div className="w-full h-6 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                                    <div className={`${tankLevelColor} h-full transition-all duration-700`} style={{ width: `${percentage}%` }} />
                                                </div>
                                                <div className="mt-2 flex justify-between text-xs text-slate-500">
                                                    <span>0L</span>
                                                    <span>{fuelTank.capacity}L</span>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                <p className="text-xs uppercase font-bold text-slate-500">Contador da Bomba</p>
                                                <p className="text-xl font-black text-slate-900 font-mono">{String(fuelTank.pumpTotalizer || 0).padStart(6, '0')}L</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="surface-card p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-black text-slate-900">Tendência de Consumo</h3>
                                            <div className="flex gap-1">
                                                {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setTrendRange(mode)}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${trendRange === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                                                    >
                                                        {mode === 'daily' ? 'Diário' : mode === 'weekly' ? 'Semanal' : 'Mensal'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {trendSeries.length > 1 ? (
                                            <div className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                                    <polyline
                                                        fill="none"
                                                        stroke="#2563eb"
                                                        strokeWidth="2"
                                                        points={trendPoints}
                                                    />
                                                    {trendSeries.map((point, idx) => {
                                                        const x = trendSeries.length === 1 ? 0 : (idx / (trendSeries.length - 1)) * 100;
                                                        const y = 100 - (point.value / trendMax) * 100;
                                                        return <circle key={point.label} cx={x} cy={y} r="1.6" fill="#1d4ed8" />;
                                                    })}
                                                </svg>
                                            </div>
                                        ) : (
                                            <div className="h-48 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 text-sm">
                                                Dados insuficientes para gerar tendência.
                                            </div>
                                        )}
                                    </div>

                                    <div className="surface-card p-5">
                                        <h3 className="text-lg font-black text-slate-900 mb-4">Consumo por Viatura</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Top 5 maior consumo</p>
                                                <div className="space-y-2">
                                                    {topConsumptionVehicles.length === 0 && <p className="text-xs text-slate-400">Sem dados.</p>}
                                                    {topConsumptionVehicles.map((row, idx) => (
                                                        <div key={`${row.vehicleId}-high`} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                            <span className="font-semibold text-slate-700">{idx + 1}. {row.matricula}</span>
                                                            <span className="font-bold text-slate-900">{row.liters.toFixed(1)}L</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Menor consumo</p>
                                                <div className="space-y-2">
                                                    {lowestConsumptionVehicles.length === 0 && <p className="text-xs text-slate-400">Sem dados.</p>}
                                                    {lowestConsumptionVehicles.map((row, idx) => (
                                                        <div key={`${row.vehicleId}-low`} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                            <span className="font-semibold text-slate-700">{idx + 1}. {row.matricula}</span>
                                                            <span className="font-bold text-slate-900">{row.liters.toFixed(1)}L</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Eficiência (L/100km)</p>
                                                <div className="space-y-2">
                                                    {efficiencyRanking.length === 0 && <p className="text-xs text-slate-400">Sem dados.</p>}
                                                    {efficiencyRanking.map((row, idx) => (
                                                        <div key={`${row.vehicleId}-eff`} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                            <span className="font-semibold text-slate-700">{idx + 1}. {row.matricula}</span>
                                                            <span className="font-bold text-slate-900">{row.avgConsumption.toFixed(1)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="surface-card p-5">
                                        <h3 className="text-lg font-black text-slate-900 mb-4">Ações Rápidas</h3>
                                        <div className="space-y-2.5">
                                            <button onClick={() => setActiveTab('abastecer')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors">
                                                <span>Registar Saída</span>
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setActiveTab('tanque')} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors">
                                                <span>Reabastecer Depósito</span>
                                                <Truck className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setIsEditingTank(true)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-400 transition-colors">
                                                <span>Corrigir Contador da Bomba</span>
                                                <Gauge className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                            <button onClick={exportAuditReport} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700">Export report</button>
                                            <button onClick={() => setActiveTab('historico')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700">View history</button>
                                            <button onClick={() => setActiveTab('historico')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700">Open anomalies</button>
                                        </div>
                                    </div>

                                    <div className="surface-card p-5">
                                        <h3 className="text-lg font-black text-slate-900 mb-4">Alertas Operacionais</h3>
                                        <div className="space-y-2.5">
                                            {dashboardAlerts.length === 0 && (
                                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                                                    Nenhum alerta crítico no momento.
                                                </div>
                                            )}

                                            {dashboardAlerts.map((alert, idx) => {
                                                const levelClass = alert.severity === 'high'
                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                    : alert.severity === 'medium'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                        : 'border-blue-200 bg-blue-50 text-blue-700';
                                                const stamp = formatDateTime(alert.timestamp);

                                                return (
                                                    <div key={`${alert.title}-${idx}`} className={`rounded-xl border p-3 ${levelClass}`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="font-bold text-sm">{alert.title}</p>
                                                            <span className="text-[10px] uppercase font-bold">{alert.severity}</span>
                                                        </div>
                                                        <p className="text-xs mt-1">{alert.description}</p>
                                                        <p className="text-[11px] mt-1 opacity-80">{stamp.date} {stamp.time}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="surface-card p-5">
                                        <h3 className="text-lg font-black text-slate-900 mb-4">Pump Monitoring</h3>
                                        <div className="space-y-2 text-sm text-slate-700">
                                            <p><span className="text-slate-500">Last pump activity:</span> {lastPumpActivity ? `${formatDateTime(lastPumpActivity.timestamp).date} ${formatDateTime(lastPumpActivity.timestamp).time}` : '--'}</p>
                                            <p><span className="text-slate-500">Total pumped today:</span> {pumpToday.toFixed(1)}L</p>
                                            <p><span className="text-slate-500">Pump health status:</span> {pumpHealthStatus}</p>
                                            <p><span className="text-slate-500">Last calibration date:</span> {latestRefill ? formatDateTime(latestRefill.timestamp).date : '--'}</p>
                                        </div>
                                    </div>

                                    <div className="surface-card p-5">
                                        <h3 className="text-lg font-black text-slate-900 mb-2">Previsão</h3>
                                        <p className="text-sm text-slate-600">
                                            Fuel will reach minimum level in {daysToMinimum > 0 ? `${daysToMinimum.toFixed(1)} days` : '--'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Baseado no consumo médio recente de {avgDailyConsumption.toFixed(1)}L/dia.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* REFUEL TAB */}
                {activeTab === 'abastecer' && (
                    <div className="surface-card p-6 lg:p-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2">
                                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                                        <Fuel className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Abastecer Viatura</h2>
                                        <p className="text-sm text-slate-500">Registo de saída com validação inteligente</p>
                                    </div>
                                </div>

                                <form onSubmit={handleInitiateRefuel} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Motorista (Opcional)</label>
                                            <select
                                                value={refuelForm.driverId}
                                                onChange={(e) => setRefuelForm({ ...refuelForm, driverId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800"
                                            >
                                                <option value="">Sem condutor associado</option>
                                                {motoristas.map(m => (
                                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">{t('fuel.form.vehicle')}</label>
                                            <select
                                                required
                                                value={refuelForm.vehicleId}
                                                onChange={(e) => setRefuelForm({ ...refuelForm, vehicleId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800"
                                            >
                                                <option value="">Selecione Viatura</option>
                                                {viaturas.map(v => (
                                                    <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">{t('fuel.form.liters')}</label>
                                            <div className="relative">
                                                <input
                                                    required
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={refuelForm.liters}
                                                    onChange={(e) => setRefuelForm({ ...refuelForm, liters: e.target.value })}
                                                    className="w-full px-4 py-3 pr-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800 font-semibold"
                                                    placeholder="0.0"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">L</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">{t('fuel.form.km')}</label>
                                            <div className="relative">
                                                <input
                                                    required
                                                    type="number"
                                                    min="0"
                                                    value={refuelForm.km}
                                                    onChange={(e) => setRefuelForm({ ...refuelForm, km: e.target.value })}
                                                    className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800 font-semibold"
                                                    placeholder="000000"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">KM</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Centro de Custos (Opcional)</label>
                                            <select
                                                value={refuelForm.centroCustoId}
                                                onChange={(e) => setRefuelForm({ ...refuelForm, centroCustoId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800"
                                            >
                                                <option value="">Nenhum (Geral)</option>
                                                {centrosCustos.map(cc => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Autonomia estimada após abastecimento</label>
                                            <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700">
                                                {estimatedAutonomyAfterRefuelKm > 0 ? `${estimatedAutonomyAfterRefuelKm.toFixed(0)} km` : '--'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Data</label>
                                            <input
                                                type="date"
                                                required
                                                value={refuelForm.manualDate}
                                                onChange={(e) => setRefuelForm({ ...refuelForm, manualDate: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Hora</label>
                                            <input
                                                type="time"
                                                required
                                                value={refuelForm.manualTime}
                                                onChange={(e) => setRefuelForm({ ...refuelForm, manualTime: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Observações (Opcional)</label>
                                        <textarea
                                            value={refuelForm.notes}
                                            onChange={(e) => setRefuelForm({ ...refuelForm, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/50 outline-none text-slate-800"
                                            placeholder="Ex: abastecimento em turno noturno, validação manual de odómetro, etc."
                                        />
                                    </div>

                                    {refuelWarnings.length > 0 && (
                                        <div className="space-y-2">
                                            {refuelWarnings.map((warning, idx) => (
                                                <div key={`${warning.message}-${idx}`} className={`rounded-xl border p-3 text-sm ${warning.severity === 'high' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                                    <strong className="uppercase text-xs mr-2">{warning.severity}</strong>
                                                    {warning.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-3 border-t border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('overview')}
                                            className="px-6 py-3 text-slate-500 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-black py-3 px-5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Check className="w-5 h-5" />
                                            Confirmar Abastecimento
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="space-y-4">
                                <div className="surface-card p-4">
                                    <h3 className="text-sm uppercase tracking-wider font-black text-slate-500 mb-3">Resumo da Viatura</h3>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="text-slate-500">Viatura:</span> <span className="font-semibold text-slate-800">{selectedVehicle ? `${selectedVehicle.matricula} ${selectedVehicle.marca}` : '--'}</span></p>
                                        <p><span className="text-slate-500">Último abastecimento:</span> <span className="font-semibold text-slate-800">{lastVehicleTx ? `${formatDateTime(lastVehicleTx.timestamp).date} ${formatDateTime(lastVehicleTx.timestamp).time}` : '--'}</span></p>
                                        <p><span className="text-slate-500">Últimos litros:</span> <span className="font-semibold text-slate-800">{lastVehicleTx ? `${Number(lastVehicleTx.liters || 0).toFixed(1)}L` : '--'}</span></p>
                                        <p><span className="text-slate-500">Consumo mensal:</span> <span className="font-semibold text-slate-800">{selectedVehicleMonthlyConsumption.toFixed(1)}L</span></p>
                                        <p><span className="text-slate-500">Consumo médio:</span> <span className="font-semibold text-slate-800">{avgVehicleConsumption > 0 ? `${avgVehicleConsumption.toFixed(1)} L/100km` : '--'}</span></p>
                                        <p><span className="text-slate-500">Último KM:</span> <span className="font-semibold text-slate-800">{lastKm > 0 ? lastKm.toLocaleString('pt-PT') : '--'}</span></p>
                                        <p><span className="text-slate-500">Salto de KM:</span> <span className={`font-semibold ${mileageJump < 0 ? 'text-red-600' : mileageJump > 1200 ? 'text-amber-600' : 'text-emerald-600'}`}>{mileageJump ? `${mileageJump > 0 ? '+' : ''}${mileageJump} km` : '--'}</span></p>
                                        <p><span className="text-slate-500">Expected fuel range:</span> <span className="font-semibold text-slate-800">{expectedLitersForJump > 0 ? `${expectedLitersForJump.toFixed(1)}L` : '--'}</span></p>
                                        <p><span className="text-slate-500">Efficiency score:</span> <span className="font-semibold text-slate-800">{efficiencyScore}%</span></p>
                                    </div>
                                </div>

                                <div className="surface-card p-4">
                                    <h3 className="text-sm uppercase tracking-wider font-black text-slate-500 mb-3">Validação Operacional</h3>
                                    <p className="text-sm text-slate-600">As validações de quilometragem e consumo são verificadas antes da confirmação.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUPPLY TAB */}
                {activeTab === 'tanque' && (
                    <div className="w-full min-w-0 bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-6 mb-10 pb-8 border-b border-slate-100">
                            <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-900/20 rotate-3">
                                <Truck className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Reabastecer Tanque</h2>
                                <p className="text-slate-400 text-lg mt-1">Registo de entrada de combustível (Cisterna)</p>
                            </div>
                        </div>

                        <form onSubmit={handleRegisterSupply} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Fornecedor</label>
                                    <input
                                        required
                                        type="text"
                                        value={supplyForm.supplier}
                                        onChange={(e) => setSupplyForm({ ...supplyForm, supplier: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all font-medium text-lg"
                                        placeholder="Ex: Galp, Repsol..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Litros Entregues</label>
                                    <div className="relative group">
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={supplyForm.litersAdded}
                                            onChange={(e) => setSupplyForm({ ...supplyForm, litersAdded: e.target.value })}
                                            className="w-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all font-mono text-xl"
                                            placeholder="0.0"
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">L</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Preço por Litro (€)</label>
                                    <div className="relative group">
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={supplyForm.pricePerLiter}
                                            onChange={(e) => setSupplyForm({ ...supplyForm, pricePerLiter: e.target.value })}
                                            className="w-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all font-mono text-xl"
                                            placeholder="0.000"
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">€</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Data de Entrega</label>
                                    <input
                                        required
                                        type="date"
                                        value={supplyForm.manualDate}
                                        onChange={(e) => setSupplyForm({ ...supplyForm, manualDate: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all font-medium text-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Hora de Entrega</label>
                                    <input
                                        required
                                        type="time"
                                        value={supplyForm.manualTime}
                                        onChange={(e) => setSupplyForm({ ...supplyForm, manualTime: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all font-medium text-lg"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Leitura Bomba do Camião (Opcional)</label>
                                    <input
                                        type="number"
                                        value={supplyForm.pumpReading}
                                        onChange={(e) => setSupplyForm({ ...supplyForm, pumpReading: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none text-slate-900 transition-all font-mono text-lg"
                                        placeholder="000000"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('overview')}
                                    className="px-8 py-4 text-slate-500 hover:text-slate-700 font-bold hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg py-4 px-6 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-6 h-6" />
                                    Confirmar Entrada
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'historico' && (
                    <div className="bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-[2.5rem] p-8 animate-in slide-in-from-right-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <History className="w-6 h-6 text-blue-600" />
                                Histórico de Transações
                            </h2>
                            <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200">
                                <Filter className="w-4 h-4 text-slate-500 ml-2" />
                                <select
                                    value={filters.vehicleId}
                                    onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}
                                    className="bg-transparent text-sm text-slate-700 outline-none font-bold"
                                >
                                    <option value="">Viatura: Todas</option>
                                    {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                                </select>
                                <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                                <select
                                    value={filters.centroCustoId}
                                    onChange={(e) => setFilters({ ...filters, centroCustoId: e.target.value })}
                                    className="bg-transparent text-sm text-slate-700 outline-none font-bold"
                                >
                                    <option value="">C.Custo: Todos</option>
                                    {centrosCustos.map(cc => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                                </select>
                                <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    className="bg-transparent text-sm text-slate-700 outline-none font-bold"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 table-scroll">
                            <table className="w-full text-left text-sm" style={{ minWidth: '750px' }}>
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider">
                                    <tr>
                                        <th className="px-3 md:px-6 py-4">Data/Hora</th>
                                        <th className="px-3 md:px-6 py-4">Viatura</th>
                                        <th className="px-3 md:px-6 py-4">Condutor</th>
                                        <th className="px-3 md:px-6 py-4">C. Custo</th>
                                        <th className="px-3 md:px-6 py-4 text-right">Litros</th>
                                        <th className="px-3 md:px-6 py-4 text-right">Valor</th>
                                        <th className="px-3 md:px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {fuelTransactions
                                        .filter(tx => {
                                            const matchesVehicle = !filters.vehicleId || tx.vehicleId === filters.vehicleId;
                                            const matchesCC = !filters.centroCustoId || tx.centroCustoId === filters.centroCustoId;
                                            const matchesDate = !filters.startDate || (tx.timestamp || '').startsWith(filters.startDate);
                                            return matchesVehicle && matchesCC && matchesDate;
                                        })
                                        .map(tx => {
                                            const driver = motoristas.find(m => m.id === tx.driverId);
                                            const vehicle = viaturas.find(v => v.id === tx.vehicleId);
                                            const { date, time } = formatDateTime(tx.timestamp);
                                            return (
                                                <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${tx.isAnormal ? 'bg-red-500/5' : ''}`}>
                                                    <td className="px-6 py-4 text-slate-600 font-mono">
                                                        {date}
                                                        <span className="text-slate-400 ml-2 text-xs">{time}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900">{vehicle?.matricula}</span>
                                                            <span className="text-[10px] text-slate-500 uppercase">{vehicle?.marca} {vehicle?.modelo}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-600">
                                                                {driver ? driver.nome : (tx.driverId === null ? 'Importação BP' : 'N/A')}
                                                            </span>
                                                            {tx.isAnormal && (
                                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                                        {centrosCustos.find(c => c.id === tx.centroCustoId)?.nome || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-mono text-yellow-500 font-bold">{tx.liters} L</span>
                                                            {tx.consumoCalculado && (
                                                                <span className="text-[10px] text-slate-500">{tx.consumoCalculado} L/100km</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-700 font-bold">
                                                        {tx.totalCost ? `${tx.totalCost.toFixed(2)}€` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {vehicle?.id && (
                                                                <button
                                                                    onClick={() => navigate(`/viaturas/${vehicle.id}`)}
                                                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
                                                                    title="Abrir perfil da viatura"
                                                                >
                                                                    <Car className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setEditingTransaction(tx)}
                                                                className="text-slate-500 hover:text-blue-600 transition-colors"
                                                                title="Editar registo"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            {hasAccess(userRole, 'combustivel_delete') && (
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('Tem a certeza que deseja eliminar este registo?')) deleteFuelTransaction(tx.id);
                                                                    }}
                                                                    className="text-slate-600 hover:text-red-400 transition-colors"
                                                                    title="Eliminar registo"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {fuelTransactions.length === 0 && (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">Nenhum registo encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* BP TAB */}
                {activeTab === 'bp' && (
                    <div className="bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-[2.5rem] p-8 animate-in slide-in-from-right-4">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <FileSpreadsheet className="w-6 h-6 text-green-400" />
                                Importar BP
                            </h2>
                            <div className="flex gap-2">
                                {bpTransactions.length > 0 && (
                                    <button
                                        onClick={handleConfirmBPImport}
                                        disabled={selectedRows.length === 0}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-900/20 animate-in fade-in zoom-in"
                                    >
                                        <Check className="w-4 h-4" />
                                        Importar Selecionados ({selectedRows.length})
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsManualBPOpen(true)}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Inserir Manual
                                </button>
                                <button
                                    onClick={handleDownloadBPTemplate}
                                    className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Template
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50 hover:bg-slate-50/70 transition-all cursor-pointer group mb-8 relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".xlsx,.xls,.pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleImportBP}
                            />
                            <div className="flex gap-4 mb-4">
                                <Upload className="w-12 h-12 text-slate-600 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <p className="text-xl font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Arraste um ficheiro ou clique para upload</p>
                            <div className="flex gap-4 mt-3">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    <FileText className="w-3.5 h-3.5 text-red-400" />
                                    Fatura BP (.pdf)
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                                    Excel (.xlsx)
                                </span>
                            </div>
                        </div>

                        {bpTransactions.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap justify-between items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-xl">Pré-visualização ({bpTransactions.length} registos)</h3>
                                            <p className="text-[11px] text-slate-500">Registos encontrados: {bpTransactions.length}</p>
                                        </div>
                                        {selectedRows.length > 0 && (
                                            <div className="flex items-center gap-2 bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/30 animate-in fade-in slide-in-from-left-2">
                                                <span className="text-blue-600 text-sm font-bold">{selectedRows.length} selecionados</span>
                                                <div className="h-4 w-[1px] bg-blue-500/30 mx-1" />
                                                <select
                                                    className="bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-900 outline-none focus:border-amber-400"
                                                    value={bulkCC}
                                                    onChange={(e) => setBulkCC(e.target.value)}
                                                >
                                                    <option value="">Aplicar C.Custo...</option>
                                                    {centrosCustos.map(cc => (
                                                        <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        if (!bulkCC) return;
                                                        const newTransactions = [...bpTransactions];
                                                        selectedRows.forEach((idx: number) => {
                                                            newTransactions[idx]._selectedCC = bulkCC;
                                                        });
                                                        setBpTransactions(newTransactions);
                                                        setSelectedRows([]);
                                                        setBulkCC('');
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors"
                                                >
                                                    Atribuir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedRows(bpTransactions.map((_: any, i: number) => i))}
                                            className="px-4 py-2 bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg text-sm font-bold"
                                        >
                                            Selecionar Todos
                                        </button>
                                        <button
                                            onClick={() => setSelectedRows([])}
                                            className="px-4 py-2 bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-sm font-bold"
                                        >
                                            Limpar Seleção
                                        </button>
                                        <button
                                            onClick={() => {
                                                setBpTransactions([]);
                                                setSelectedRows([]);
                                            }}
                                            className="px-4 py-2 bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg text-sm font-bold"
                                        >
                                            Limpar Lista
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-slate-200 table-scroll">
                                    <table className="w-full text-sm text-left" style={{ minWidth: '800px' }}>
                                        <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-widest whitespace-nowrap">
                                            <tr>
                                                <th className="px-3 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-200 bg-white/90 text-blue-600 focus:ring-blue-500"
                                                        checked={selectedRows.length === bpTransactions.length && bpTransactions.length > 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedRows(bpTransactions.map((_: any, i: number) => i));
                                                            } else {
                                                                setSelectedRows([]);
                                                            }
                                                        }}
                                                    />
                                                </th>
                                                <th className="px-3 py-4">Data/Hora</th>
                                                <th className="px-3 py-4">Talão</th>
                                                <th className="px-3 py-4 font-black text-slate-900">Viatura</th>
                                                <th className="px-3 py-4 text-center">KM</th>
                                                <th className="px-3 py-4">Posto</th>
                                                <th className="px-3 py-4">Produto</th>
                                                <th className="px-3 py-4 text-right">Qtd. (L)</th>
                                                <th className="px-3 py-4 text-right text-emerald-700">Total (€)</th>
                                                <th className="px-3 py-4 min-w-[150px]">Centro de Custo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {bpTransactions.map((row: any, i: number) => {
                                                const diaHora = row['Dia Hora'];
                                                const dataVal = row['Data'];
                                                const horaVal = row['Hora'];
                                                let dateObj: Date | null = null;

                                                if (row._manualDate) {
                                                    dateObj = new Date(row._manualDate);
                                                    const h = excelDateToJSDate(horaVal);
                                                    if (h && dateObj) dateObj.setHours(h.getHours(), h.getMinutes());
                                                } else {
                                                    const primaryDate = diaHora || dataVal;
                                                    if (primaryDate) {
                                                        dateObj = excelDateToJSDate(primaryDate);
                                                        if (dateObj && horaVal) {
                                                            const h = excelDateToJSDate(horaVal);
                                                            if (h) dateObj.setHours(h.getHours(), h.getMinutes());
                                                        }
                                                    }
                                                }

                                                let displayDate = '-';
                                                if (dateObj && !isNaN(dateObj.getTime())) {
                                                    displayDate = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                }

                                                const liters = parseImportNumber(row['Litros']);
                                                const price = parseImportNumber(row['Preço Unitário']);
                                                const total = parseImportNumber(row['Total']) || (liters * price);

                                                return (
                                                    <tr key={i} className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${selectedRows.includes(i) ? 'bg-blue-600/5' : ''}`}>
                                                        <td className="px-3 py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-200 bg-white/90 text-blue-600 focus:ring-blue-500"
                                                                checked={selectedRows.includes(i)}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedRows((prev: number[]) => [...prev, i]);
                                                                    } else {
                                                                        setSelectedRows((prev: number[]) => prev.filter((idx: number) => idx !== i));
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap text-[12px]">{displayDate}</td>
                                                        <td className="px-3 py-3 text-slate-400 font-mono text-[12px] whitespace-nowrap">{row._talao || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-900 font-black text-[14px] whitespace-nowrap">{row['Matrícula'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-400 font-mono text-[12px] text-center">{row['Km'] || '0'}</td>
                                                        <td className="px-3 py-3 text-slate-400 text-[11px] truncate max-w-[150px]">{row['Posto'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-500 text-[11px] uppercase font-bold">{row['Produto'] || '-'}</td>
                                                        <td className="px-3 py-3 text-yellow-500 font-bold font-mono text-[13px] text-right">{liters.toFixed(2)}L</td>
                                                        <td className="px-3 py-3 text-emerald-700 font-black font-mono text-[13px] text-right">{total.toFixed(2)}€</td>
                                                        <td className="px-3 py-3">
                                                            <select
                                                                className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-amber-400 w-full"
                                                                value={row._selectedCC || ''}
                                                                onChange={(e) => {
                                                                    const newTransactions = [...bpTransactions];
                                                                    newTransactions[i]._selectedCC = e.target.value;
                                                                    setBpTransactions(newTransactions);
                                                                }}
                                                            >
                                                                <option value="">-- C.Custo --</option>
                                                                {centrosCustos.map(cc => (
                                                                    <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MANUAL BP MODAL */}
                {isManualBPOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white/90 border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Plus className="w-6 h-6 text-blue-500" />
                                Inserir Talão BP Manual
                            </h3>
                            <form onSubmit={handleManualBPAdd} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Data</label>
                                        <input
                                            required type="date"
                                            value={manualBPForm.date}
                                            onChange={e => setManualBPForm({ ...manualBPForm, date: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Hora</label>
                                        <input
                                            required type="time"
                                            value={manualBPForm.time}
                                            onChange={e => setManualBPForm({ ...manualBPForm, time: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">Matrícula</label>
                                    <input
                                        required type="text" placeholder="Sem traços (ex: AA00BB)"
                                        value={manualBPForm.licensePlate}
                                        onChange={e => setManualBPForm({ ...manualBPForm, licensePlate: e.target.value.toUpperCase() })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-blue-500 uppercase"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Litros</label>
                                        <input
                                            required type="number" step="0.01"
                                            value={manualBPForm.liters}
                                            onChange={e => setManualBPForm({ ...manualBPForm, liters: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Total (€)</label>
                                        <input
                                            required type="number" step="0.01"
                                            value={manualBPForm.totalCost}
                                            onChange={e => setManualBPForm({ ...manualBPForm, totalCost: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-emerald-500 font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">Posto (Opcional)</label>
                                    <input
                                        type="text"
                                        value={manualBPForm.station}
                                        onChange={e => setManualBPForm({ ...manualBPForm, station: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">Centro de Custo</label>
                                    <select
                                        value={manualBPForm.centroCustoId}
                                        onChange={e => setManualBPForm({ ...manualBPForm, centroCustoId: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-900 outline-none focus:border-blue-500"
                                    >
                                        <option value="">-- Selecionar --</option>
                                        {centrosCustos.map(cc => (
                                            <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsManualBPOpen(false)}
                                        className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* REPORTS / AUDIT TAB */}
                {activeTab === 'relatorios' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-md">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-emerald-500/20 rounded-2xl">
                                        <Plus className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Total Entradas Tanque</span>
                                </div>
                                <div className="text-3xl font-black text-slate-900">{totalTankIn.toLocaleString()} <span className="text-sm text-slate-500">Litros</span></div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 backdrop-blur-md">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-blue-500/20 rounded-2xl">
                                        <TrendingUp className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Total Saídas Oficina</span>
                                </div>
                                <div className="text-3xl font-black text-slate-900">{totalInternalLiters.toLocaleString()} <span className="text-sm text-slate-500">Litros</span></div>
                            </div>

                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-md">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-purple-500/20 rounded-2xl">
                                        <AlertCircle className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Diferença Acumulada</span>
                                </div>
                                <div className="text-3xl font-black text-slate-900">{(totalTankIn - totalInternalLiters).toLocaleString()} <span className="text-sm text-slate-500">Litros</span></div>
                            </div>
                        </div>

                        {/* Tank Refill History */}
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                    <Droplets className="w-6 h-6 text-emerald-400" />
                                    Registo de Entradas e Consumo por Intervalo
                                </h2>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    <button
                                        onClick={exportWorkshopRefuelSheetPDF}
                                        className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-amber-500/20"
                                    >
                                        <FileText className="w-5 h-5" />
                                        Folha de Registo (PDF)
                                    </button>
                                    <button
                                        onClick={exportAuditReport}
                                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-2xl font-bold transition-all border border-slate-200 shadow-xl"
                                    >
                                        <Download className="w-5 h-5" />
                                        Exportar Auditoria (Excel)
                                    </button>
                                    <button
                                        onClick={exportIntervalsPDF}
                                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20"
                                    >
                                        <FileSpreadsheet className="w-5 h-5" />
                                        Exportar PDF Detalhado
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mb-6 max-w-3xl">
                                Gere uma folha imprimível para motoristas e equipa da oficina registarem manualmente abastecimentos feitos no tanque interno, com campos de assinatura e controlo por viatura.
                            </p>

                            <div className="overflow-x-auto rounded-2xl border border-slate-200 table-scroll">
                                <table className="w-full text-left text-sm" style={{ minWidth: '850px' }}>
                                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider">
                                        <tr>
                                            <th className="px-3 md:px-6 py-4">Data Entrega</th>
                                            <th className="px-3 md:px-6 py-4">Fornecedor</th>
                                            <th className="px-3 md:px-6 py-4 text-right">L. Entregues</th>
                                            <th className="px-3 md:px-6 py-4 text-right bg-blue-50 text-blue-700">Saída (L)</th>
                                            <th className="px-3 md:px-6 py-4 text-right bg-blue-50 text-blue-700">Custo Saída</th>
                                            <th className="px-3 md:px-6 py-4 text-right">Nível Antes</th>
                                            <th className="px-3 md:px-6 py-4 text-right">Nível Depois</th>
                                            <th className="px-3 md:px-6 py-4 text-right">Audit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            const sortedRefills = [...tankRefills].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                                            // Prepend Current Period (pseudo-refill for "since last until now")
                                            const latestRefill = sortedRefills[sortedRefills.length - 1];
                                            const currentPeriodTransactions = fuelTransactions.filter(tx =>
                                                !tx.isExternal &&
                                                tx.status === 'confirmed' &&
                                                (!latestRefill || new Date(tx.timestamp) > new Date(latestRefill.timestamp))
                                            );

                                            const rows = sortedRefills.map((refill, idx) => {
                                                const prevRefill = idx > 0 ? sortedRefills[idx - 1] : null;
                                                const start = prevRefill ? new Date(prevRefill.timestamp) : new Date(0);
                                                const end = new Date(refill.timestamp);

                                                const intervalTxs = fuelTransactions.filter(tx =>
                                                    !tx.isExternal &&
                                                    tx.status === 'confirmed' &&
                                                    new Date(tx.timestamp) > start &&
                                                    new Date(tx.timestamp) <= end
                                                );

                                                const litersOut = intervalTxs.reduce((sum, tx) => sum + tx.liters, 0);
                                                const costOut = intervalTxs.reduce((sum, tx) => sum + (tx.totalCost || 0), 0);

                                                return {
                                                    ...refill,
                                                    litersOut,
                                                    costOut,
                                                    isCurrent: false
                                                };
                                            });

                                            // Add current status at the top
                                            if (latestRefill) {
                                                const currentLitersOut = currentPeriodTransactions.reduce((sum, tx) => sum + tx.liters, 0);
                                                const currentCostOut = currentPeriodTransactions.reduce((sum, tx) => sum + (tx.totalCost || 0), 0);
                                                rows.push({
                                                    id: 'current',
                                                    timestamp: new Date().toISOString(),
                                                    supplier: 'PERÍODO ATUAL',
                                                    litersAdded: 0,
                                                    litersOut: currentLitersOut,
                                                    costOut: currentCostOut,
                                                    levelBefore: fuelTank.currentLevel,
                                                    levelAfter: fuelTank.currentLevel,
                                                    isCurrent: true,
                                                    staffId: '',
                                                    totalSpentSinceLast: 0,
                                                    pumpMeterReading: fuelTank.pumpTotalizer
                                                } as any);
                                            }

                                            return rows.reverse().map(refill => {
                                                const LIMIT = 6000;
                                                const totalCalc = refill.levelBefore + refill.litersAdded;
                                                const isOverLimit = totalCalc > LIMIT;

                                                return (
                                                    <tr key={refill.id} className={`hover:bg-slate-50 transition-colors ${refill.isCurrent ? 'bg-blue-500/5' : ''} ${isOverLimit ? 'bg-red-500/5' : ''}`}>
                                                        <td className="px-6 py-4 text-slate-600 font-mono text-[12px]">
                                                            {refill.isCurrent ? (
                                                                <span className="flex items-center gap-2 text-blue-600 font-black">
                                                                    <TrendingUp className="w-3 h-3" /> AGORA
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    {new Date(refill.timestamp).toLocaleDateString()}
                                                                    <span className="text-slate-600 ml-2 text-[10px]">{new Date(refill.timestamp).toLocaleTimeString()}</span>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className={`px-6 py-4 font-bold ${refill.isCurrent ? 'text-blue-600' : 'text-slate-800'}`}>
                                                            {refill.supplier || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-emerald-700">
                                                            {refill.litersAdded > 0 ? `${refill.litersAdded} L` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-amber-500 bg-blue-50">
                                                            {refill.litersOut.toFixed(1)} L
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-700 bg-blue-50">
                                                            {refill.costOut > 0 ? `${refill.costOut.toFixed(2)}€` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-slate-400">
                                                            {refill.isCurrent ? '-' : `${refill.levelBefore} L`}
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-bold ${isOverLimit ? 'text-red-600' : 'text-slate-800'}`}>
                                                            <div className="flex flex-col items-end">
                                                                <span>{refill.isCurrent ? `${fuelTank.currentLevel} L` : `${refill.levelAfter} L`}</span>
                                                                {isOverLimit && (
                                                                    <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-600 mt-1 flex items-center gap-1">
                                                                        <AlertCircle className="w-3 h-3" /> +{(totalCalc - LIMIT).toFixed(1)} L Excesso
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {!refill.isCurrent && userRole === 'admin' && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm('Deseja apagar este registo de reabastecimento? O nível do tanque será revertido.')) {
                                                                            await deleteTankRefill(refill.id);
                                                                        }
                                                                    }}
                                                                    className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                        {tankRefills.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold italic">
                                                    Nenhum registo de entrada encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Monthly Totals Section */}
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-yellow-500/10 rounded-2xl">
                                    <BarChart3 className="w-6 h-6 text-yellow-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Totais por Mês</h2>
                                    <p className="text-slate-400 text-sm mt-1">Soma de litros e custo de todos os abastecimentos (Oficina + BP)</p>
                                </div>
                            </div>

                            {(() => {
                                const allConfirmed = fuelTransactions.filter(tx => tx.status === 'confirmed');

                                type MonthEntry = { liters: number; cost: number; count: number; };
                                const byMonth: Record<string, MonthEntry> = {};

                                allConfirmed.forEach(tx => {
                                    const d = new Date(tx.timestamp);
                                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    if (!byMonth[key]) byMonth[key] = { liters: 0, cost: 0, count: 0 };
                                    byMonth[key].liters += tx.liters || 0;
                                    byMonth[key].cost += tx.totalCost || 0;
                                    byMonth[key].count += 1;
                                });

                                const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
                                const grandLiters = months.reduce((s, k) => s + byMonth[k].liters, 0);
                                const grandCost = months.reduce((s, k) => s + byMonth[k].cost, 0);
                                const grandCount = months.reduce((s, k) => s + byMonth[k].count, 0);

                                const ptMonths = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

                                if (months.length === 0) {
                                    return (
                                        <div className="text-center py-12 text-slate-500 font-bold">
                                            Nenhum abastecimento registado ainda.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200 table-scroll">
                                        <table className="w-full text-left text-sm" style={{ minWidth: '650px' }}>
                                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-4">Mês</th>
                                                    <th className="px-6 py-4 text-center">Nº Abast.</th>
                                                    <th className="px-6 py-4 text-right text-yellow-600">Total Litros</th>
                                                    <th className="px-6 py-4 text-right text-emerald-700">Total Gasto</th>
                                                    <th className="px-6 py-4 text-right text-slate-500">€/Litro Médio</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {months.map((key, idx) => {
                                                    const [year, month] = key.split('-');
                                                    const label = `${ptMonths[parseInt(month) - 1]} ${year}`;
                                                    const entry = byMonth[key];
                                                    const avgPrice = entry.liters > 0 ? entry.cost / entry.liters : 0;
                                                    const now = new Date();
                                                    const isCurrentMonth = parseInt(year) === now.getFullYear() && parseInt(month) === now.getMonth() + 1;

                                                    return (
                                                        <tr key={key} className={`hover:bg-slate-50 transition-colors ${isCurrentMonth ? 'bg-blue-500/5 border-l-2 border-blue-500' : idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`font-bold ${isCurrentMonth ? 'text-blue-600' : 'text-slate-800'}`}>{label}</span>
                                                                    {isCurrentMonth && (
                                                                        <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                                            Atual
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 font-bold text-xs">
                                                                    {entry.count}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="text-yellow-600 font-black text-lg font-mono">{entry.liters.toFixed(1)}</span>
                                                                <span className="text-slate-500 text-xs ml-1">L</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="text-emerald-700 font-black text-lg font-mono">{entry.cost.toFixed(2)}</span>
                                                                <span className="text-slate-500 text-xs ml-1">€</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className={`font-bold font-mono text-sm ${avgPrice > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                                                                    {avgPrice > 0 ? `${avgPrice.toFixed(3)} €/L` : '—'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-50 border-t-2 border-slate-200">
                                                    <td className="px-6 py-5">
                                                        <span className="text-slate-700 font-black uppercase text-xs tracking-[0.15em]">Total Geral</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="bg-yellow-100 border border-yellow-300 text-yellow-700 px-3 py-1 rounded-full font-black text-xs">{grandCount}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="text-yellow-600 font-black text-xl font-mono">{grandLiters.toFixed(1)}</span>
                                                        <span className="text-slate-500 text-xs ml-1">L</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="text-emerald-700 font-black text-xl font-mono">{grandCost.toFixed(2)}</span>
                                                        <span className="text-slate-500 text-xs ml-1">€</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="text-slate-600 font-bold font-mono text-sm">
                                                            {grandLiters > 0 ? `${(grandCost / grandLiters).toFixed(3)} €/L` : '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}


                {/* EDIT TANK MODAL */}
                {
                    isEditingTank && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                            <div className="bg-white/90 border border-slate-200 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                                <h3 className="text-xl font-bold text-slate-900 mb-6">Configurar Tanque</h3>
                                <form onSubmit={saveTankChanges} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Capacidade Total (L)</label>
                                        <input
                                            type="number"
                                            className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editTankForm.capacity}
                                            onChange={e => setEditTankForm({ ...editTankForm, capacity: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Nível Atual (L)</label>
                                        <input
                                            type="number"
                                            className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editTankForm.currentLevel}
                                            onChange={e => setEditTankForm({ ...editTankForm, currentLevel: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Preço Médio (€)</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editTankForm.averagePrice}
                                            onChange={e => setEditTankForm({ ...editTankForm, averagePrice: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase font-mono">Contador da Bomba (L)</label>
                                        <input
                                            type="number"
                                            className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                                            value={editTankForm.pumpTotalizer}
                                            onChange={e => setEditTankForm({ ...editTankForm, pumpTotalizer: e.target.value })}
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-slate-200">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Baseline (Saldo Confirmado)</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Data do Baseline</label>
                                                <input
                                                    type="date"
                                                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-yellow-500 outline-none"
                                                    value={editTankForm.baselineDate ? editTankForm.baselineDate.split('T')[0] : ''}
                                                    onChange={e => setEditTankForm({ ...editTankForm, baselineDate: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Saldo no Baseline (L)</label>
                                                <input
                                                    type="number"
                                                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-yellow-500 outline-none"
                                                    value={editTankForm.baselineLevel}
                                                    onChange={e => setEditTankForm({ ...editTankForm, baselineLevel: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase">Contador no Baseline (L)</label>
                                                <input
                                                    type="number"
                                                    className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-yellow-500 outline-none"
                                                    value={editTankForm.baselineTotalizer}
                                                    onChange={e => setEditTankForm({ ...editTankForm, baselineTotalizer: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditTankForm({
                                                            ...editTankForm,
                                                            baselineDate: new Date().toISOString().split('T')[0],
                                                            baselineLevel: editTankForm.currentLevel,
                                                            baselineTotalizer: editTankForm.pumpTotalizer
                                                        });
                                                    }}
                                                    className="w-full py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                                >
                                                    Fixar Estado Atual como Baseline
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const result = await recalculateFuelTank();
                                                            setEditTankForm({
                                                                ...editTankForm,
                                                                currentLevel: String(result.newLevel),
                                                                pumpTotalizer: String(result.newTotalizer)
                                                            });
                                                            alert("Recalculado com sucesso com base no histórico!");
                                                        } catch (err: any) {
                                                            alert(err.message);
                                                        }
                                                    }}
                                                    className="w-full py-2 bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                                >
                                                    Recalcular a partir do Baseline
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button type="button" onClick={() => setIsEditingTank(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold">Cancelar</button>
                                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Guardar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
                {/* EDIT TRANSACTION MODAL */}
                {
                    editingTransaction && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-white/90 border border-slate-200 rounded-[2rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/90">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Editar Abastecimento</h3>
                                        <p className="text-slate-500 text-sm mt-1">ID: {editingTransaction.id}</p>
                                    </div>
                                    <button onClick={() => setEditingTransaction(null)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <form onSubmit={handleUpdateTransaction} className="p-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Viatura</label>
                                            <select
                                                value={editingTransaction.vehicleId}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, vehicleId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            >
                                                {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Utilizador</label>
                                            <select
                                                value={editingTransaction.driverId}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, driverId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            >
                                                <option value="">Não Atribuído (BP)</option>
                                                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome} - {(m.tipoUtilizador || (m as any).tipo_utilizador || 'motorista')}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Litros</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editingTransaction.liters}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, liters: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Km</label>
                                            <input
                                                type="number"
                                                value={editingTransaction.km || ''}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, km: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Custo (€)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editingTransaction.totalCost}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, totalCost: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Data e Hora</label>
                                            <input
                                                type="datetime-local"
                                                value={new Date(new Date(editingTransaction.timestamp).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, timestamp: new Date(e.target.value).toISOString() })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Centro de Custo</label>
                                            <select
                                                value={editingTransaction.centroCustoId}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, centroCustoId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 transition-all"
                                            >
                                                <option value="">Sem Centro de Custo</option>
                                                {centrosCustos.map(cc => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setEditingTransaction(null)}
                                            className="flex-1 px-6 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-2xl font-bold transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20"
                                        >
                                            Guardar Alterações
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
}
