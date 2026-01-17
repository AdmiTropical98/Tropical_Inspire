import { useState, useRef } from 'react';
import {
    Fuel, Droplets, History, Check, Truck,
    Gauge, Trash2, LayoutTemplate, BarChart3,
    Settings, Upload, Download, FileSpreadsheet,
    X, AlertCircle, Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { excelDateToJSDate } from '../../utils/format';

export default function Combustivel() {
    const {
        fuelTank, fuelTransactions, registerRefuel, motoristas, viaturas, tankRefills, registerTankRefill, deleteFuelTransaction, setPumpTotalizer, centrosCustos, deleteTankRefill, updateFuelTank
    } = useWorkshop();
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<'overview' | 'abastecer' | 'tanque' | 'historico' | 'bp'>('overview');
    const [bpTransactions, setBpTransactions] = useState<any[]>([]); // Temp state for BP imports
    const [selectedRows, setSelectedRows] = useState<number[]>([]); // For bulk actions
    const [bulkCC, setBulkCC] = useState('');
    const [bypassDriverPin, setBypassDriverPin] = useState(false); // Admin override for PIN
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
        pricePerLiter: ''
    });

    // Calibration State
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationValue, setCalibrationValue] = useState('');

    // Tank Edit State
    const [isEditingTank, setIsEditingTank] = useState(false);
    const [editTankForm, setEditTankForm] = useState({
        capacity: '',
        currentLevel: '',
        averagePrice: ''
    });

    const handleEditTank = () => {
        setEditTankForm({
            capacity: fuelTank.capacity.toString(),
            currentLevel: fuelTank.currentLevel.toString(),
            averagePrice: (fuelTank.averagePrice || 0).toString()
        });
        setIsEditingTank(true);
    };

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
            averagePrice: newPrice
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
        if (liters > fuelTank.currentLevel) {
            alert('Combustível insuficiente no tanque!');
            return;
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
        } catch (error) {
            console.error(error);
            alert('Erro ao registar abastecimento.');
        }
    };

    const handleRegisterSupply = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await registerTankRefill({
                id: crypto.randomUUID(),
                supplier: supplyForm.supplier,
                litersAdded: Number(supplyForm.litersAdded),
                pumpMeterReading: supplyForm.pumpReading ? Number(supplyForm.pumpReading) : 0, // Fixed property name
                pricePerLiter: Number(supplyForm.pricePerLiter),
                levelBefore: fuelTank.currentLevel,
                levelAfter: Math.min(fuelTank.capacity, fuelTank.currentLevel + Number(supplyForm.litersAdded)),
                totalSpentSinceLast: 0, // You might want to calculate this or leave 0
                timestamp: new Date().toISOString(),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Admin',
                systemExpectedReading: fuelTank.pumpTotalizer,
                totalCost: Number(supplyForm.litersAdded) * Number(supplyForm.pricePerLiter)
            });
            setSupplyForm({ supplier: '', litersAdded: '', pumpReading: '', pricePerLiter: '' });
            alert('Entrada de combustível registada com sucesso!');
            setActiveTab('overview');
        } catch (error) {
            alert('Erro ao registar entrada.');
        }
    };

    // Calculate percentage for tank visual
    const percentage = Math.min(100, Math.max(0, (fuelTank.currentLevel / fuelTank.capacity) * 100));

    // Get recent transactions for overview
    const recentTransactions = fuelTransactions.slice(0, 5);

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
                'Nº transação': '1012187',
                'Nº cartão': '886',
                'Proprietário': '51-NR-36',
                'Matrícula': '51-NR-36',
                'Km': 449100,
                'Dia laboral': 'Y',
                'Posto': 'VILAMOURA',
                'Produto': 'GASOLEO',
                'Quantidade': 64.77,
                'Preço': 1.2509,
                'Valor líquido': 81.02,
                'IVA': 18.64,
                'Valor total a faturar': 99.66,
                'IVA%': '23,00'
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
                // driverId must be a valid UUID or NULL. 'BP_IMPORT' fails FK constraint.
                const transaction: any = {
                    id: crypto.randomUUID(),
                    vehicleId: vehicle ? vehicle.id : (cleanPlate || 'UNKNOWN_PLATE'), // Use clean plate if no ID found, but warn user via "Unmatched" UI later?
                    driverId: null, // BP import usually doesn't have driver UUID. Send null.
                    liters: parseImportNumber(row['Litros']),
                    pricePerLiter: parseImportNumber(row['Preço Unitário']),
                    totalCost: parseImportNumber(row['Total']),
                    km: parseImportNumber(row['Km']),
                    status: 'confirmed',
                    timestamp: timestamp,
                    staffId: currentUser?.id || 'admin',
                    staffName: currentUser?.nome || 'Admin',
                    centroCustoId: ccId || null
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

    // --- Counter Calibration ---
    const handleCalibrateTank = () => {
        setCalibrationValue('');
        setIsCalibrating(true);
    };

    const confirmCalibration = () => {
        const newVal = Number(calibrationValue);
        if (!isNaN(newVal)) {
            setPumpTotalizer(newVal);
            setIsCalibrating(false);
        }
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Main Stats Card */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl group">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-yellow-500/10 transition-colors duration-500"></div>

                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div>
                                        <h2 className="text-2xl font-black text-white mb-2">Estado do Tanque</h2>
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-400 font-medium">Capacidade Total</span>
                                            <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-300 border border-slate-700">{fuelTank.capacity} L</span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md ${percentage < 20 ? 'bg-red-500/10 border-red-500/20 shadow-red-900/10' : 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-900/10'}`}>
                                        <span className={`w-2.5 h-2.5 rounded-full ${percentage < 20 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                        <span className={`text-sm font-bold uppercase tracking-wider ${percentage < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {percentage < 20 ? 'Nível Crítico' : 'Nível Normal'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                                    {/* Tank Visual */}
                                    <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800 relative overflow-hidden flex flex-col justify-between h-56 group/tank">
                                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-yellow-600 to-yellow-400 opacity-20 transition-all duration-1000 ease-in-out group-hover/tank:opacity-30" style={{ height: `${percentage}%` }}></div>
                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]" style={{ bottom: `${percentage}%`, transition: 'bottom 1s ease-in-out' }}></div>

                                        <div className="relative z-10 flex justify-between items-start">
                                            <Droplets className="w-6 h-6 text-yellow-500" />
                                            <span className="text-2xl font-black text-white">{Math.round(percentage)}%</span>
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Disponível</p>
                                            <p className="text-4xl font-black text-white">{fuelTank.currentLevel} <span className="text-lg text-slate-500 font-bold">L</span></p>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-2 gap-6">
                                        {/* AVERAGE PRICE CARD */}
                                        <div className="bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50 hover:bg-slate-800/50 transition-all relative group/avg">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                                                        <BarChart3 className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 uppercase">Preço Médio</span>
                                                </div>
                                                {hasAccess(userRole, 'combustivel_edit') && (
                                                    <button
                                                        onClick={handleEditTank}
                                                        className="text-slate-600 hover:text-white transition-colors opacity-0 group-hover/avg:opacity-100"
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-3xl font-black text-white ml-2">{(fuelTank.averagePrice || 0).toFixed(3)}</p>
                                                <p className="text-sm text-slate-500 font-medium mt-1 ml-2">EUR / Litro</p>
                                            </div>
                                        </div>

                                        {/* COUNTER CARD */}
                                        <div className="bg-slate-800/30 p-6 rounded-3xl border border-slate-700/50 hover:bg-slate-800/50 transition-all relative group/counter">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                                        <Gauge className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 uppercase">Contador</span>
                                                </div>
                                                {hasAccess(userRole, 'combustivel_calibrate') && (
                                                    <button
                                                        onClick={handleCalibrateTank}
                                                        className="text-slate-600 hover:text-white transition-colors opacity-0 group-hover/counter:opacity-100"
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {isCalibrating ? (
                                                <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={calibrationValue}
                                                        onChange={e => setCalibrationValue(e.target.value)}
                                                        className="w-full bg-slate-950 border border-blue-500 rounded-lg px-2 py-1 text-white font-mono text-lg outline-none"
                                                    />
                                                    <button onClick={confirmCalibration} className="bg-blue-600 p-1.5 rounded-lg text-white"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => setIsCalibrating(false)} className="bg-slate-700 p-1.5 rounded-lg text-slate-300"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-3xl font-black text-white font-mono tracking-tight ml-2">{String(fuelTank.pumpTotalizer || 0).padStart(6, '0')}</p>
                                                    <p className="text-sm text-slate-500 font-medium mt-1 ml-2">Litros Totais</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    onClick={() => setActiveTab('abastecer')}
                                    className="group bg-slate-900 border border-slate-800 p-6 rounded-[2rem] hover:border-yellow-500/50 transition-all text-left relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0">
                                        <Fuel className="w-24 h-24 text-yellow-500" />
                                    </div>
                                    <div className="w-14 h-14 bg-yellow-500 rounded-2xl flex items-center justify-center text-black mb-4 shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform">
                                        <Fuel className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">Registar Abastecimento</h3>
                                    <p className="text-slate-400">Saída de combustível para viatura</p>
                                </button>

                                <button
                                    onClick={() => setActiveTab('tanque')}
                                    className="group bg-slate-900 border border-slate-800 p-6 rounded-[2rem] hover:border-emerald-500/50 transition-all text-left relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0">
                                        <Truck className="w-24 h-24 text-emerald-500" />
                                    </div>
                                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-900/20 group-hover:scale-110 transition-transform">
                                        <Truck className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">Reabastecer Tanque</h3>
                                    <p className="text-slate-400">Entrada de combustível (Camião Cisterna)</p>
                                </button>
                            </div>
                        </div>

                        {/* Sidebar Stats */}
                        <div className="space-y-6">
                            <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 h-full backdrop-blur-md">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <History className="w-5 h-5 text-slate-400" />
                                        Recentes
                                    </h3>
                                    <button onClick={() => setActiveTab('historico')} className="text-xs font-bold text-blue-400 hover:text-white transition-colors">VER TUDO</button>
                                </div>
                                <div className="space-y-4">
                                    {recentTransactions.length > 0 ? (
                                        recentTransactions.map(tx => {
                                            const driver = motoristas.find(m => m.id === tx.driverId);
                                            const vehicle = viaturas.find(v => v.id === tx.vehicleId);
                                            return (
                                                <div key={tx.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2 text-white font-bold">
                                                            <span className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-mono">{vehicle?.matricula.slice(0, 2)}</span>
                                                            <span>{vehicle?.matricula}</span>
                                                        </div>
                                                        <span className="text-yellow-400 font-bold font-mono">{tx.liters}L</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-slate-500">
                                                        <span>{driver?.nome.split(' ')[0]}</span>
                                                        <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-12 text-slate-500 italic">Sem movimentos recentes</div>
                                    )}
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
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <History className="w-6 h-6 text-blue-400" />
                                Histórico de Transações
                            </h2>
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
                                    {fuelTransactions.map(tx => {
                                        const driver = motoristas.find(m => m.id === tx.driverId);
                                        const vehicle = viaturas.find(v => v.id === tx.vehicleId);
                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 text-slate-300 font-mono">
                                                    {new Date(tx.timestamp).toLocaleDateString()}
                                                    <span className="text-slate-600 ml-2 text-xs">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-white">{vehicle?.matricula}</td>
                                                <td className="px-6 py-4 text-slate-300">
                                                    {driver ? driver.nome : (tx.driverId === null ? 'Importação BP' : 'N/A')}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {centrosCustos.find(c => c.id === tx.centroCustoId)?.nome || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-yellow-500 font-bold">{tx.liters} L</td>
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
                                                        selectedRows.forEach(idx => {
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
                                                                setSelectedRows(bpTransactions.map((_, i) => i));
                                                            } else {
                                                                setSelectedRows([]);
                                                            }
                                                        }}
                                                    />
                                                </th>
                                                <th className="px-3 py-4">Data/Hora</th>
                                                <th className="px-3 py-4">Trans.</th>
                                                <th className="px-3 py-4">Cartão</th>
                                                <th className="px-3 py-4">Proprietário</th>
                                                <th className="px-3 py-4 font-black text-white">Viatura</th>
                                                <th className="px-3 py-4">KM</th>
                                                <th className="px-3 py-4">P.</th>
                                                <th className="px-3 py-4">Posto</th>
                                                <th className="px-3 py-4">Produto</th>
                                                <th className="px-3 py-4">Qtd.</th>
                                                <th className="px-3 py-4">P/L</th>
                                                <th className="px-3 py-4 text-emerald-400">Total</th>
                                                <th className="px-3 py-4 min-w-[150px]">Centro de Custo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                                            {bpTransactions.map((row, i) => {
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
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedRows(prev => [...prev, i]);
                                                                    } else {
                                                                        setSelectedRows(prev => prev.filter(idx => idx !== i));
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3 text-slate-300 font-medium whitespace-nowrap text-[12px]">{displayDate}</td>
                                                        <td className="px-3 py-3 text-slate-500 font-mono text-[11px]">{row['Nº transação'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-500 font-mono text-[11px]">{row['Nº cartão'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-500 text-[11px] truncate max-w-[100px]">{row['Proprietário'] || '-'}</td>
                                                        <td className="px-3 py-3 text-white font-black text-[14px] whitespace-nowrap">{row['Matrícula'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-400 font-mono text-[12px]">{row['Km'] || '0'}</td>
                                                        <td className="px-3 py-3 text-slate-500 text-[11px]">{row['Dia laboral'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-400 text-[11px] truncate max-w-[120px]">{row['Posto'] || '-'}</td>
                                                        <td className="px-3 py-3 text-slate-500 text-[11px] uppercase font-bold">{row['Produto'] || '-'}</td>
                                                        <td className="px-3 py-3 text-yellow-500 font-bold font-mono text-[13px]">{liters.toFixed(2)}L</td>
                                                        <td className="px-3 py-3 text-slate-400 font-mono text-[11px]">{price > 0 ? `${price.toFixed(3)}€` : '-'}</td>
                                                        <td className="px-3 py-3 text-emerald-400 font-black font-mono text-[13px]">{total > 0 ? `${total.toFixed(2)}€` : '-'}</td>
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
