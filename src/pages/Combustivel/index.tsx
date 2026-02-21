import { useState, useRef } from 'react';
import {
    Fuel, Droplets, History, Check, Truck,
    Gauge, Trash2, LayoutTemplate, BarChart3,
    Upload, Download, FileSpreadsheet,
    AlertCircle, Plus, TrendingUp, Zap, Car, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { excelDateToJSDate } from '../../utils/format';

export default function Combustivel() {
    const {
        fuelTank, fuelTransactions, tankRefills, registerRefuel, motoristas, viaturas, registerTankRefill, deleteFuelTransaction, deleteTankRefill, centrosCustos, updateFuelTank, vehicleMetrics, recalculateFuelTank
    } = useWorkshop();
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<'overview' | 'abastecer' | 'tanque' | 'historico' | 'bp' | 'relatorios'>('overview');
    const [bpTransactions, setBpTransactions] = useState<any[]>([]); // Temp state for BP imports
    const [selectedRows, setSelectedRows] = useState<number[]>([]); // For bulk actions
    const [bulkCC, setBulkCC] = useState('');
    const [bypassDriverPin, setBypassDriverPin] = useState(false); // Admin override for PIN
    const [selectedViaturaId, setSelectedViaturaId] = useState<string>('');
    const [filters, setFilters] = useState({
        vehicleId: '',
        driverId: '',
        centroCustoId: '',
        startDate: '',
        endDate: ''
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fuel Form State
    const [refuelForm, setRefuelForm] = useState({
        driverId: '',
        vehicleId: '',
        liters: '',
        km: '',
        centroCustoId: '',
        manualDate: '',
        manualTime: ''
    });

    // Tank Supply Form State
    const [supplyForm, setSupplyForm] = useState({
        supplier: '',
        litersAdded: '',
        pumpReading: '',
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

    // Dual Authentication State
    const [authModal, setAuthModal] = useState({
        isOpen: false,
        step: 1, // 1: Admin/Staff Auth, 2: Driver Auth
        adminPassword: '',
        driverPin: '',
        error: ''
    });

    // Manual BP Entry State
    const [isManualBPOpen, setIsManualBPOpen] = useState(false);
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
        setAuthModal({
            isOpen: true,
            step: 1,
            adminPassword: '',
            driverPin: '',
            error: ''
        });
    };

    const handleDualAuth = async () => {
        setAuthModal(prev => ({ ...prev, error: '' }));

        if (authModal.step === 1) {
            if (!authModal.adminPassword) {
                setAuthModal(prev => ({ ...prev, error: 'Palavra-passe obrigatória' }));
                return;
            }

            if (userRole !== 'admin' && userRole !== 'oficina') {
                setAuthModal(prev => ({ ...prev, error: 'Sem permissão para autorizar' }));
                return;
            }

            if (userRole === 'admin' && bypassDriverPin) {
                setAuthModal(prev => ({ ...prev, isOpen: false }));
                await confirmRefuel();
                return;
            }

            setAuthModal(prev => ({ ...prev, step: 2 }));

        } else {
            const driver = motoristas.find(m => m.id === refuelForm.driverId);
            if (!driver) {
                setAuthModal(prev => ({ ...prev, error: 'Condutor não encontrado' }));
                return;
            }

            if (driver.pin !== authModal.driverPin) {
                setAuthModal(prev => ({ ...prev, error: 'PIN do condutor incorreto' }));
                return;
            }

            setAuthModal(prev => ({ ...prev, isOpen: false }));
            await confirmRefuel();
        }
    };


    const confirmRefuel = async () => {
        const liters = Number(refuelForm.liters);
        const refuelDate = (refuelForm.manualDate && refuelForm.manualTime)
            ? new Date(`${refuelForm.manualDate}T${refuelForm.manualTime}`)
            : new Date();

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

        try {
            const isConfirmed = userRole === 'admin' && bypassDriverPin;

            await registerRefuel({
                id: crypto.randomUUID(),
                driverId: refuelForm.driverId,
                vehicleId: refuelForm.vehicleId,
                liters: liters,
                km: Number(refuelForm.km),
                centroCustoId: refuelForm.centroCustoId || undefined,
                status: isConfirmed ? 'confirmed' : 'pending',
                timestamp: (isConfirmed && refuelForm.manualDate && refuelForm.manualTime)
                    ? new Date(`${refuelForm.manualDate}T${refuelForm.manualTime}`).toISOString()
                    : new Date().toISOString(),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Admin'
            });

            setRefuelForm({ driverId: '', vehicleId: '', liters: '', km: '', centroCustoId: '', manualDate: '', manualTime: '' });
            alert(isConfirmed ? 'Abastecimento registado e confirmado com sucesso!' : 'Abastecimento registado! A aguardar confirmação do motorista.');
            setActiveTab('overview');
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao registar abastecimento: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleRegisterSupply = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const refillDate = (supplyForm.manualDate && supplyForm.manualTime)
                ? new Date(`${supplyForm.manualDate}T${supplyForm.manualTime}`)
                : new Date();

            await registerTankRefill({
                id: crypto.randomUUID(),
                supplier: supplyForm.supplier,
                litersAdded: Number(supplyForm.litersAdded),
                pumpMeterReading: supplyForm.pumpReading ? Number(supplyForm.pumpReading) : 0, // Fixed property name
                pricePerLiter: Number(supplyForm.pricePerLiter),
                levelBefore: fuelTank.currentLevel,
                levelAfter: Math.min(fuelTank.capacity, fuelTank.currentLevel + Number(supplyForm.litersAdded)),
                totalSpentSinceLast: 0, // You might want to calculate this or leave 0
                timestamp: refillDate.toISOString(),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Admin',
                systemExpectedReading: fuelTank.pumpTotalizer,
                totalCost: Number(supplyForm.litersAdded) * Number(supplyForm.pricePerLiter)
            });
            setSupplyForm({
                supplier: '',
                litersAdded: '',
                pumpReading: '',
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

    const handleImportBP = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmBPImport = async () => {
        if (!confirm(`Confirma a importação de ${bpTransactions.length} registos?`)) return;

        let successCount = 0;
        let errorCount = 0;

        for (const row of bpTransactions as any[]) {
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
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Switch to history tab so user sees the new records immediately
            setActiveTab('historico');
        }
    };

    const internalRefuels = fuelTransactions.filter(tx => !tx.isExternal && tx.status === 'confirmed');
    const totalInternalLiters = internalRefuels.reduce((sum, tx) => sum + tx.liters, 0);
    const totalTankIn = tankRefills.reduce((sum, r) => sum + r.litersAdded, 0);

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

    return (
        <div className="flex flex-col h-screen overflow-hidden relative bg-slate-950 text-white">
            {/* Dark Background Forced for Fuel Page */}

            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">

                {/* Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-4">
                            <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                                <Fuel className="w-8 h-8 text-yellow-500" />
                            </div>
                            <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-transparent bg-clip-text">
                                {t('fuel.title')}
                            </span>
                        </h1>
                        <p className="text-slate-400 text-lg font-medium max-w-2xl">{t('fuel.subtitle')}</p>
                    </div>

                    <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-lg overflow-x-auto max-w-full">
                        {[
                            { id: 'overview', icon: LayoutTemplate, label: 'Visão Geral' },
                            { id: 'abastecer', icon: Fuel, label: 'Abastecer Viatura' },
                            { id: 'tanque', icon: Droplets, label: 'Reabastecer Tanque' },
                            { id: 'historico', icon: History, label: 'Histórico' },
                            { id: 'bp', icon: FileSpreadsheet, label: 'BP' },
                            { id: 'relatorios', icon: BarChart3, label: 'Relatórios' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap
                                ${activeTab === tab.id
                                        ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Header & Vehicle Selector */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 backdrop-blur-xl">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Dashboard de Combustível</h2>
                                <p className="text-slate-400 font-medium">Análise de consumo e eficiência por viatura</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <select
                                        value={selectedViaturaId}
                                        onChange={(e) => setSelectedViaturaId(e.target.value)}
                                        className="bg-slate-950 border border-slate-700 text-white rounded-2xl pl-12 pr-10 py-3 outline-none focus:border-yellow-500 transition-all appearance-none font-bold min-w-[240px]"
                                    >
                                        <option value="">Todas as Viaturas</option>
                                        {viaturas.map(v => (
                                            <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Filter className="w-4 h-4 text-slate-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main Metrics Card */}
                            <div className="lg:col-span-2 space-y-8">
                                {/* Tank Status & Summary */}
                                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-[3rem] relative overflow-hidden shadow-2xl group">
                                    <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-yellow-500/10 transition-colors duration-500"></div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                        {/* Tank Visual */}
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xl font-bold text-white">Estado do Depósito</h3>
                                                <div className="flex items-center gap-2">
                                                    {userRole === 'admin' && (
                                                        <button
                                                            onClick={() => {
                                                                setEditTankForm({
                                                                    capacity: String(fuelTank.capacity),
                                                                    currentLevel: String(fuelTank.currentLevel),
                                                                    averagePrice: String(fuelTank.averagePrice),
                                                                    pumpTotalizer: String(fuelTank.pumpTotalizer || ''),
                                                                    baselineDate: fuelTank.baselineDate || '',
                                                                    baselineLevel: String(fuelTank.baselineLevel || ''),
                                                                    baselineTotalizer: String(fuelTank.baselineTotalizer || '')
                                                                });
                                                                setIsEditingTank(true);
                                                            }}
                                                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                                                            title="Configurar Tanque"
                                                        >
                                                            <Droplets className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase border ${percentage < 20 ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                        {percentage < 20 ? 'Crítico' : 'Normal'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-950/50 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between h-64 group/tank shadow-inner">
                                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-yellow-600 to-yellow-400 opacity-20 transition-all duration-1000 ease-in-out group-hover/tank:opacity-30" style={{ height: `${percentage}%` }}></div>
                                                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)]" style={{ bottom: `${percentage}%`, transition: 'bottom 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>

                                                <div className="relative z-10 flex justify-between items-start">
                                                    <div className="p-3 bg-yellow-500/10 rounded-2xl">
                                                        <Droplets className="w-7 h-7 text-yellow-500" />
                                                    </div>
                                                    <span className="text-4xl font-black text-white">{Math.round(percentage)}%</span>
                                                </div>
                                                <div className="relative z-10">
                                                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Disponível no Tanque</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-6xl font-black text-white tracking-tighter">{fuelTank.currentLevel}</span>
                                                        <span className="text-2xl text-slate-500 font-bold">Litros</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Global Stats */}
                                        <div className="grid grid-cols-1 gap-6">
                                            <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-slate-700/50 hover:bg-slate-800/50 transition-all group/price">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
                                                            <BarChart3 className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Custo Médio PMP</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-black text-white">{(fuelTank.averagePrice || 0).toFixed(3)}</span>
                                                    <span className="text-slate-500 font-bold font-mono">€/L</span>
                                                </div>
                                            </div>

                                            <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-slate-700/50 hover:bg-slate-800/50 transition-all group/total">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                                                            <Gauge className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Contador da Bomba</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-white font-mono tracking-tighter">
                                                        {String(fuelTank.pumpTotalizer || 0).padStart(6, '0')}
                                                    </span>
                                                    <span className="text-slate-500 font-bold">L</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {selectedViaturaId && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
                                        {/* Per-Vehicle Metrics */}
                                        {(() => {
                                            const metrics = vehicleMetrics.find(m => m.vehicleId === selectedViaturaId);
                                            return (
                                                <>
                                                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl group hover:border-blue-500/50 transition-all">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                                                                <TrendingUp className="w-5 h-5" />
                                                            </div>
                                                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Consumo Médio</span>
                                                        </div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-3xl font-black text-white">{metrics?.consumoMedio || '--'}</span>
                                                            <span className="text-slate-500 font-bold text-sm">L/100km</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl group hover:border-yellow-500/50 transition-all">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-400 group-hover:scale-110 transition-transform">
                                                                <Zap className="w-5 h-5" />
                                                            </div>
                                                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Estimativa Autonomia</span>
                                                        </div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-3xl font-black text-white">{metrics?.estimativaAutonomia || '--'}</span>
                                                            <span className="text-slate-500 font-bold text-sm">KM</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl group hover:border-emerald-500/50 transition-all">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                                                                <History className="w-5 h-5" />
                                                            </div>
                                                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Abast. Mês Atual</span>
                                                        </div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-3xl font-black text-white">{metrics?.totalLitrosMes || '0'}</span>
                                                            <span className="text-slate-500 font-bold text-sm">Litros</span>
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Sidebar - Quick Actions & Alerts */}
                            <div className="space-y-8">
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-slate-400" />
                                        Alertas e Anomalias
                                    </h3>

                                    <div className="space-y-4">
                                        {(() => {
                                            const anomalies = fuelTransactions
                                                .filter(tx => tx.isAnormal && tx.status === 'confirmed')
                                                .slice(0, 3);

                                            if (anomalies.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-3">
                                                        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                                                            <Check className="w-6 h-6" />
                                                        </div>
                                                        <p className="text-sm font-medium">Nenhuma anomalia detectada</p>
                                                    </div>
                                                );
                                            }

                                            return anomalies.map(tx => {
                                                const v = viaturas.find(vi => vi.id === tx.vehicleId);
                                                return (
                                                    <div key={tx.id} className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl flex gap-4">
                                                        <div className="p-2 bg-red-500/20 rounded-xl self-start">
                                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-white font-bold text-sm">Consumo Elevado: {tx.consumoCalculado}L/100km</p>
                                                            <p className="text-slate-500 text-xs mt-1">{v?.matricula} • {new Date(tx.timestamp).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        onClick={() => setActiveTab('abastecer')}
                                        className="w-full group bg-yellow-500 hover:bg-yellow-400 p-5 rounded-3xl transition-all shadow-xl shadow-yellow-500/20 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-black/10 p-2 rounded-xl group-hover:scale-110 transition-transform">
                                                <Fuel className="w-6 h-6 text-black" />
                                            </div>
                                            <span className="text-black font-black uppercase tracking-wider text-sm">Registar Saída</span>
                                        </div>
                                        <Plus className="w-5 h-5 text-black" />
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('tanque')}
                                        className="w-full group bg-slate-800 hover:bg-slate-700 p-5 rounded-3xl transition-all border border-slate-700 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                                                <Truck className="w-6 h-6" />
                                            </div>
                                            <span className="text-white font-bold uppercase tracking-wider text-sm">Reabastecer Stock</span>
                                        </div>
                                        <Plus className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* REFUEL TAB */}
                {activeTab === 'abastecer' && (
                    <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-6 mb-10 pb-8 border-b border-slate-800">
                            <div className="w-16 h-16 bg-yellow-500 rounded-3xl flex items-center justify-center text-black shadow-xl shadow-yellow-500/20 rotate-3">
                                <Fuel className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">{t('fuel.form.title')}</h2>
                                <p className="text-slate-400 text-lg mt-1">Registo de saída de combustível</p>
                            </div>
                        </div>

                        <form onSubmit={handleInitiateRefuel} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('fuel.form.driver')}</label>
                                    <select
                                        required
                                        value={refuelForm.driverId}
                                        onChange={(e) => setRefuelForm({ ...refuelForm, driverId: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all font-medium text-lg"
                                    >
                                        <option value="">Selecione Condutor</option>
                                        {motoristas.map(m => (
                                            <option key={m.id} value={m.id}>{m.nome} ({m.cartaConducao})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('fuel.form.vehicle')}</label>
                                    <select
                                        required
                                        value={refuelForm.vehicleId}
                                        onChange={(e) => setRefuelForm({ ...refuelForm, vehicleId: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all font-medium text-lg"
                                    >
                                        <option value="">Selecione Viatura</option>
                                        {viaturas.map(v => (
                                            <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('fuel.form.liters')}</label>
                                    <div className="relative group">
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={refuelForm.liters}
                                            onChange={(e) => setRefuelForm({ ...refuelForm, liters: e.target.value })}
                                            className="w-full pl-6 pr-12 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all font-mono text-xl"
                                            placeholder="0.0"
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">L</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('fuel.form.km')}</label>
                                    <div className="relative group">
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            value={refuelForm.km}
                                            onChange={(e) => setRefuelForm({ ...refuelForm, km: e.target.value })}
                                            className="w-full pl-6 pr-12 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all font-mono text-xl"
                                            placeholder="000000"
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">KM</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Centro de Custos (Opcional)</label>
                                <select
                                    value={refuelForm.centroCustoId}
                                    onChange={(e) => setRefuelForm({ ...refuelForm, centroCustoId: e.target.value })}
                                    className="w-full px-4 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all font-medium"
                                >
                                    <option value="">Nenhum (Geral)</option>
                                    {centrosCustos.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                    ))}
                                </select>
                            </div>

                            {userRole === 'admin' && (
                                <div className="space-y-4 bg-slate-800/30 p-4 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="bypassPin"
                                            checked={bypassDriverPin}
                                            onChange={(e) => setBypassDriverPin(e.target.checked)}
                                            className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-yellow-500 focus:ring-yellow-500/50 cursor-pointer"
                                        />
                                        <label htmlFor="bypassPin" className="text-sm font-bold text-slate-300 cursor-pointer select-none">
                                            Registo Manual (Sem PIN Condutor)
                                        </label>
                                    </div>

                                    {bypassDriverPin && (
                                        <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Data</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={refuelForm.manualDate}
                                                    onChange={(e) => setRefuelForm({ ...refuelForm, manualDate: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Hora</label>
                                                <input
                                                    type="time"
                                                    required
                                                    value={refuelForm.manualTime}
                                                    onChange={(e) => setRefuelForm({ ...refuelForm, manualTime: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-white transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-4 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('overview')}
                                    className="px-8 py-4 text-slate-400 hover:text-white font-bold hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg py-4 px-6 rounded-xl shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-6 h-6" />
                                    Confirmar Abastecimento
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* SUPPLY TAB */}
                {activeTab === 'tanque' && (
                    <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-6 mb-10 pb-8 border-b border-slate-800">
                            <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-900/20 rotate-3">
                                <Truck className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">Reabastecer Tanque</h2>
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
                                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all font-medium text-lg"
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
                                            className="w-full pl-6 pr-12 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all font-mono text-xl"
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
                                            className="w-full pl-6 pr-12 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all font-mono text-xl"
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
                                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all font-medium text-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Hora de Entrega</label>
                                    <input
                                        required
                                        type="time"
                                        value={supplyForm.manualTime}
                                        onChange={(e) => setSupplyForm({ ...supplyForm, manualTime: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all font-medium text-lg"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Leitura Bomba do Camião (Opcional)</label>
                                    <input
                                        type="number"
                                        value={supplyForm.pumpReading}
                                        onChange={(e) => setSupplyForm({ ...supplyForm, pumpReading: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-white transition-all font-mono text-lg"
                                        placeholder="000000"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('overview')}
                                    className="px-8 py-4 text-slate-400 hover:text-white font-bold hover:bg-slate-800 rounded-xl transition-all"
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
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-8 animate-in slide-in-from-right-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <History className="w-6 h-6 text-blue-400" />
                                Histórico de Transações
                            </h2>
                            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50">
                                <Filter className="w-4 h-4 text-slate-500 ml-2" />
                                <select
                                    value={filters.vehicleId}
                                    onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}
                                    className="bg-transparent text-sm text-white outline-none font-bold"
                                >
                                    <option value="">Viatura: Todas</option>
                                    {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula}</option>)}
                                </select>
                                <div className="w-[1px] h-4 bg-slate-700 mx-1" />
                                <select
                                    value={filters.centroCustoId}
                                    onChange={(e) => setFilters({ ...filters, centroCustoId: e.target.value })}
                                    className="bg-transparent text-sm text-white outline-none font-bold"
                                >
                                    <option value="">C.Custo: Todos</option>
                                    {centrosCustos.map(cc => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                                </select>
                                <div className="w-[1px] h-4 bg-slate-700 mx-1" />
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    className="bg-transparent text-sm text-white outline-none font-bold"
                                />
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-800">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Viatura</th>
                                        <th className="px-6 py-4">Condutor</th>
                                        <th className="px-6 py-4">Centro Custo</th>
                                        <th className="px-6 py-4 text-right">Litros</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                                    {fuelTransactions
                                        .filter(tx => {
                                            const matchesVehicle = !filters.vehicleId || tx.vehicleId === filters.vehicleId;
                                            const matchesCC = !filters.centroCustoId || tx.centroCustoId === filters.centroCustoId;
                                            const matchesDate = !filters.startDate || tx.timestamp.startsWith(filters.startDate);
                                            return matchesVehicle && matchesCC && matchesDate;
                                        })
                                        .map(tx => {
                                            const driver = motoristas.find(m => m.id === tx.driverId);
                                            const vehicle = viaturas.find(v => v.id === tx.vehicleId);
                                            return (
                                                <tr key={tx.id} className={`hover:bg-slate-800/50 transition-colors ${tx.isAnormal ? 'bg-red-500/5' : ''}`}>
                                                    <td className="px-6 py-4 text-slate-300 font-mono">
                                                        {new Date(tx.timestamp).toLocaleDateString()}
                                                        <span className="text-slate-600 ml-2 text-xs">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-white">{vehicle?.matricula}</span>
                                                            <span className="text-[10px] text-slate-500 uppercase">{vehicle?.marca} {vehicle?.modelo}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-300">
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
                                                    <td className="px-6 py-4 text-right font-mono text-slate-300 font-bold">
                                                        {tx.totalCost ? `${tx.totalCost.toFixed(2)}€` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {hasAccess(userRole, 'combustivel_delete') && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Tem a certeza que deseja eliminar este registo?')) deleteFuelTransaction(tx.id);
                                                                }}
                                                                className="text-slate-600 hover:text-red-400 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
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
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-8 animate-in slide-in-from-right-4">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <FileSpreadsheet className="w-6 h-6 text-green-400" />
                                Importar BP
                            </h2>
                            <div className="flex gap-2">
                                {bpTransactions.length > 0 && (
                                    <button
                                        onClick={handleConfirmBPImport}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-900/20 animate-in fade-in zoom-in"
                                    >
                                        <Check className="w-4 h-4" />
                                        Confirmar ({bpTransactions.length})
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
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Template
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-950/30 hover:bg-slate-900/30 transition-all cursor-pointer group mb-8 relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".xlsx, .xls"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleImportBP}
                            />
                            <Upload className="w-16 h-16 text-slate-600 group-hover:text-blue-500 transition-colors mb-4" />
                            <p className="text-xl font-bold text-slate-300 group-hover:text-white transition-colors">Arraste um ficheiro ou clique para upload</p>
                            <p className="text-slate-500 text-sm mt-2">Suporta ficheiros Excel (.xlsx)</p>
                        </div>

                        {bpTransactions.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap justify-between items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-white text-xl">Pré-visualização ({bpTransactions.length} registos)</h3>
                                        {selectedRows.length > 0 && (
                                            <div className="flex items-center gap-2 bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/30 animate-in fade-in slide-in-from-left-2">
                                                <span className="text-blue-400 text-sm font-bold">{selectedRows.length} selecionados</span>
                                                <div className="h-4 w-[1px] bg-blue-500/30 mx-1" />
                                                <select
                                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
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
                                            onClick={() => {
                                                setBpTransactions([]);
                                                setSelectedRows([]);
                                            }}
                                            className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-sm font-bold"
                                        >
                                            Limpar Lista
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-slate-800">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-950 text-slate-400 uppercase font-extrabold text-[10px] tracking-widest whitespace-nowrap">
                                            <tr>
                                                <th className="px-3 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
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
                                                <th className="px-3 py-4 font-black text-white">Viatura</th>
                                                <th className="px-3 py-4 text-center">KM</th>
                                                <th className="px-3 py-4">Posto</th>
                                                <th className="px-3 py-4">Produto</th>
                                                <th className="px-3 py-4 text-right">Qtd. (L)</th>
                                                <th className="px-3 py-4 text-right text-emerald-400">Total (€)</th>
                                                <th className="px-3 py-4 min-w-[150px]">Centro de Custo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
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
                                                    <tr key={i} className={`hover:bg-slate-800/30 transition-colors border-b border-slate-800/50 ${selectedRows.includes(i) ? 'bg-blue-600/5' : ''}`}>
                                                        <td className="px-3 py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
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
                                                        <td className="px-3 py-3 text-slate-300 font-medium whitespace-nowrap text-[12px]">{displayDate}</td>
                                                        <td className="px-3 py-3 text-white font-black text-[14px] whitespace-nowrap">{row['Matrícula'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-400 font-mono text-[12px] text-center">{row['Km'] || '0'}</td>
                                                        <td className="px-3 py-3 text-slate-400 text-[11px] truncate max-w-[150px]">{row['Posto'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-500 text-[11px] uppercase font-bold">{row['Produto'] || '-'}</td>
                                                        <td className="px-3 py-3 text-yellow-500 font-bold font-mono text-[13px] text-right">{liters.toFixed(2)}L</td>
                                                        <td className="px-3 py-3 text-emerald-400 font-black font-mono text-[13px] text-right">{total.toFixed(2)}€</td>
                                                        <td className="px-3 py-3">
                                                            <select
                                                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[12px] text-white outline-none focus:border-blue-500 w-full"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
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
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Hora</label>
                                        <input
                                            required type="time"
                                            value={manualBPForm.time}
                                            onChange={e => setManualBPForm({ ...manualBPForm, time: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">Matrícula</label>
                                    <input
                                        required type="text" placeholder="Sem traços (ex: AA00BB)"
                                        value={manualBPForm.licensePlate}
                                        onChange={e => setManualBPForm({ ...manualBPForm, licensePlate: e.target.value.toUpperCase() })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 uppercase"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Litros</label>
                                        <input
                                            required type="number" step="0.01"
                                            value={manualBPForm.liters}
                                            onChange={e => setManualBPForm({ ...manualBPForm, liters: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">Total (€)</label>
                                        <input
                                            required type="number" step="0.01"
                                            value={manualBPForm.totalCost}
                                            onChange={e => setManualBPForm({ ...manualBPForm, totalCost: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500 font-bold text-emerald-400"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">Posto (Opcional)</label>
                                    <input
                                        type="text"
                                        value={manualBPForm.station}
                                        onChange={e => setManualBPForm({ ...manualBPForm, station: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">Centro de Custo</label>
                                    <select
                                        value={manualBPForm.centroCustoId}
                                        onChange={e => setManualBPForm({ ...manualBPForm, centroCustoId: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500"
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
                                        className="px-4 py-2 text-slate-400 hover:text-white font-bold"
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
                                <div className="text-3xl font-black text-white">{totalTankIn.toLocaleString()} <span className="text-sm text-slate-500">Litros</span></div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 backdrop-blur-md">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-blue-500/20 rounded-2xl">
                                        <TrendingUp className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Total Saídas Oficina</span>
                                </div>
                                <div className="text-3xl font-black text-white">{totalInternalLiters.toLocaleString()} <span className="text-sm text-slate-500">Litros</span></div>
                            </div>

                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-md">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-purple-500/20 rounded-2xl">
                                        <AlertCircle className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Diferença Acumulada</span>
                                </div>
                                <div className="text-3xl font-black text-white">{(totalTankIn - totalInternalLiters).toLocaleString()} <span className="text-sm text-slate-500">Litros</span></div>
                            </div>
                        </div>

                        {/* Tank Refill History */}
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Droplets className="w-6 h-6 text-emerald-400" />
                                    Registo de Entradas no Tanque
                                </h2>
                                <button
                                    onClick={exportAuditReport}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold transition-all border border-slate-700 shadow-xl"
                                >
                                    <Download className="w-5 h-5" />
                                    Exportar Auditoria
                                </button>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-800">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Data</th>
                                            <th className="px-6 py-4">Fornecedor</th>
                                            <th className="px-6 py-4 text-right">L. Adicionados</th>
                                            <th className="px-6 py-4 text-right">Nível Antes</th>
                                            <th className="px-6 py-4 text-right">Nível Depois</th>
                                            <th className="px-6 py-4 text-right">Custo Total</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                                        {tankRefills.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(refill => (
                                            <tr key={refill.id} className="hover:bg-slate-800/5 transition-colors">
                                                <td className="px-6 py-4 text-slate-300 font-mono">
                                                    {new Date(refill.timestamp).toLocaleDateString()}
                                                    <span className="text-slate-600 ml-2 text-xs">{new Date(refill.timestamp).toLocaleTimeString()}</span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-white">{refill.supplier || 'N/A'}</td>
                                                <td className="px-6 py-4 text-right font-black text-emerald-400">{refill.litersAdded} L</td>
                                                <td className="px-6 py-4 text-right text-slate-400">{refill.levelBefore} L</td>
                                                <td className="px-6 py-4 text-right text-white">{refill.levelAfter} L</td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-300">{refill.totalCost ? `${refill.totalCost}€` : 'N/A'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    {userRole === 'admin' && (
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
                                        ))}
                                        {tankRefills.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-bold italic">
                                                    Nenhum registo de entrada encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* DUAL AUTH MODAL */}
            {authModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
                        <h3 className="text-2xl font-bold text-white mb-6 text-center">
                            {authModal.step === 1 ? 'Autenticação Responsável' : 'Autenticação Condutor'}
                        </h3>
                        {authModal.error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm font-bold">
                                <AlertCircle className="w-5 h-5" />
                                {authModal.error}
                            </div>
                        )}

                        <div className="space-y-6">
                            {authModal.step === 1 ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase block text-center">
                                        {userRole === 'oficina' ? 'PIN Oficina' : 'Password Admin'}
                                    </label>
                                    <input
                                        type="password"
                                        autoFocus
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-center text-2xl tracking-widest text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={authModal.adminPassword}
                                        onChange={e => setAuthModal({ ...authModal, adminPassword: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleDualAuth()}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase block text-center">PIN Condutor</label>
                                    <input
                                        type="password"
                                        autoFocus
                                        maxLength={6}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-center text-2xl tracking-widest text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                        value={authModal.driverPin}
                                        onChange={e => setAuthModal({ ...authModal, driverPin: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleDualAuth()}
                                    />
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setAuthModal({ ...authModal, isOpen: false, step: 1, adminPassword: '', driverPin: '' })}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDualAuth}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all"
                                >
                                    {authModal.step === 1 ? 'Seguinte' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT TANK MODAL */}
            {isEditingTank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Configurar Tanque</h3>
                        <form onSubmit={saveTankChanges} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Capacidade Total (L)</label>
                                <input
                                    type="number"
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editTankForm.capacity}
                                    onChange={e => setEditTankForm({ ...editTankForm, capacity: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Nível Atual (L)</label>
                                <input
                                    type="number"
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editTankForm.currentLevel}
                                    onChange={e => setEditTankForm({ ...editTankForm, currentLevel: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Preço Médio (€)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editTankForm.averagePrice}
                                    onChange={e => setEditTankForm({ ...editTankForm, averagePrice: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase font-mono">Contador da Bomba (L)</label>
                                <input
                                    type="number"
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                                    value={editTankForm.pumpTotalizer}
                                    onChange={e => setEditTankForm({ ...editTankForm, pumpTotalizer: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Baseline (Saldo Confirmado)</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Data do Baseline</label>
                                        <input
                                            type="date"
                                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                            value={editTankForm.baselineDate ? editTankForm.baselineDate.split('T')[0] : ''}
                                            onChange={e => setEditTankForm({ ...editTankForm, baselineDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Saldo no Baseline (L)</label>
                                        <input
                                            type="number"
                                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                            value={editTankForm.baselineLevel}
                                            onChange={e => setEditTankForm({ ...editTankForm, baselineLevel: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Contador no Baseline (L)</label>
                                        <input
                                            type="number"
                                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
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
                                            className="w-full py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                            Recalcular a partir do Baseline
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsEditingTank(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
