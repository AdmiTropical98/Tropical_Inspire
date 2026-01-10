import { useState } from 'react';
import {
    Fuel, Droplets, History, Check, Truck,
    Gauge, Trash2, LayoutTemplate, BarChart3,
    Zap, Settings, Upload, Download, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { supabase } from '../../lib/supabase';

export default function Combustivel() {
    const {
        fuelTank, fuelTransactions, registerRefuel, motoristas, viaturas, tankRefills, registerTankRefill, deleteFuelTransaction, setPumpTotalizer, centrosCustos, deleteTankRefill, updateFuelTank
    } = useWorkshop();
    const { userRole, currentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<'overview' | 'abastecer' | 'tanque' | 'historico' | 'bp'>('overview');
    const [bpTransactions, setBpTransactions] = useState<any[]>([]); // Temp state for BP imports

    // Fuel Form State
    const [refuelForm, setRefuelForm] = useState({
        driverId: '',
        vehicleId: '',
        liters: '',
        km: '',
        centroCustoId: ''
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

        // Step 1: Admin/Staff Authentication
        if (authModal.step === 1) {
            if (userRole === 'admin') {
                // Fetch the actual logged-in user's email from the session
                const { data: { user } } = await supabase.auth.getUser();
                const adminEmail = user?.email || (currentUser as any)?.email || 'admin@admin.com';

                console.log("Verifying password for:", adminEmail);

                // Verify Admin Password via Supabase Auth
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: adminEmail,
                    password: authModal.adminPassword
                });

                if (error || !data.user) {
                    console.error("Auth Error:", error);
                    const errorMsg = error?.message === 'Invalid login credentials'
                        ? 'Password incorreta.'
                        : 'Erro de autenticação. Tente novamente.';
                    setAuthModal(prev => ({ ...prev, error: errorMsg }));
                    return;
                }
            } else if (userRole === 'oficina') {
                // Verify Office Staff PIN
                // TypeScript needs to know currentUser has a pin. 'oficinaUser' type usually has it.
                // We'll assume currentUser is correct type if role is oficina.
                if ((currentUser as any)?.pin !== authModal.adminPassword) {
                    setAuthModal(prev => ({ ...prev, error: 'PIN incorreto.' }));
                    return;
                }
            } else {
                // Supervisors?? Typically don't register fuel, but if they do, use password
                // For now, assume success or block? Let's check password if they have it
                // Supervisors use password in AuthContext
                if ((currentUser as any)?.password !== authModal.adminPassword) {
                    setAuthModal(prev => ({ ...prev, error: 'Password incorreta.' }));
                    return;
                }
            }

            // If success, move to step 2
            setAuthModal(prev => ({ ...prev, step: 2, error: '' }));
            return;
        }

        // Step 2: Driver Authentication
        if (authModal.step === 2) {
            const driver = motoristas.find(m => m.id === refuelForm.driverId);
            if (!driver) {
                setAuthModal(prev => ({ ...prev, error: 'Motorista não encontrado.' }));
                return;
            }

            if (driver.pin !== authModal.driverPin) {
                setAuthModal(prev => ({ ...prev, error: 'PIN do motorista incorreto.' }));
                return;
            }

            // Both Verified! Register Refuel
            registerRefuel({
                id: crypto.randomUUID(),
                driverId: refuelForm.driverId,
                vehicleId: refuelForm.vehicleId,
                centroCustoId: refuelForm.centroCustoId,
                liters: Number(refuelForm.liters),
                km: Number(refuelForm.km),
                staffId: currentUser?.id || 'admin',
                staffName: currentUser?.nome || 'Administrador',
                status: 'confirmed', // Automatically confirmed
                timestamp: new Date().toISOString()
            });

            setRefuelForm({ driverId: '', vehicleId: '', liters: '', km: '', centroCustoId: '' });
            setAuthModal({ isOpen: false, step: 1, adminPassword: '', driverPin: '', error: '' });
            alert('Abastecimento registado e confirmado com sucesso!');
            setActiveTab('overview');
        }
    };

    const handleRegisterSupply = (e: React.FormEvent) => {
        e.preventDefault();

        const litersAdded = Number(supplyForm.litersAdded);
        const pumpReading = Number(supplyForm.pumpReading);
        const pricePerLiter = Number(supplyForm.pricePerLiter);
        const totalCost = litersAdded * pricePerLiter;
        const currentLevel = fuelTank.currentLevel;
        const systemExpected = fuelTank.pumpTotalizer || 0;

        let totalSpentSinceLast = 0;
        if (tankRefills.length > 0) {
            const lastLog = tankRefills[0];
            totalSpentSinceLast = lastLog.levelAfter - currentLevel;
        }

        registerTankRefill({
            id: crypto.randomUUID(),
            litersAdded: litersAdded,
            levelBefore: currentLevel,
            levelAfter: Math.min(fuelTank.capacity, currentLevel + litersAdded),
            totalSpentSinceLast: totalSpentSinceLast,
            pumpMeterReading: pumpReading,
            systemExpectedReading: systemExpected,
            supplier: supplyForm.supplier,
            timestamp: new Date().toISOString(),
            staffId: currentUser?.id || 'admin',
            staffName: currentUser?.nome || 'Administrador',
            pricePerLiter: pricePerLiter,
            totalCost: totalCost
        });

        setSupplyForm({ supplier: '', litersAdded: '', pumpReading: '', pricePerLiter: '' });
        alert('Reabastecimento do tanque registado com sucesso!');
        setActiveTab('overview');
    };

    const handleCalibrateTank = () => {
        if (!isCalibrating) {
            setCalibrationValue(String(fuelTank.pumpTotalizer || 0));
        }
        setIsCalibrating(!isCalibrating);
    };

    const confirmCalibration = () => {
        const parsedLevel = Number(calibrationValue);
        if (isNaN(parsedLevel) || parsedLevel < 0 || parsedLevel > fuelTank.capacity) {
            alert('Valor inválido. Certifique-se que é um número entre 0 e ' + fuelTank.capacity);
            return;
        }

        if (confirm(`Tem a certeza que deseja alterar o contador da bomba para ${parsedLevel}L?`)) {
            setPumpTotalizer(parsedLevel);
            setIsCalibrating(false);
        }
    };

    const handleDownloadBPTemplate = () => {
        const headers = ['Data', 'Hora', 'Estacao', 'Matricula', 'Produto', 'Quantidade', 'PrecoUnit', 'Total'];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BP_Template");
        XLSX.writeFile(wb, "Template_Abastecimentos_BP.xlsx");
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
            const data = XLSX.utils.sheet_to_json(ws);
            setBpTransactions(data);
            alert(`${data.length} registos importados com sucesso!`);
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    const percentage = (fuelTank.currentLevel / fuelTank.capacity) * 100;

    // Get recent transactions for the sidebar
    const recentTransactions = [...fuelTransactions]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar max-w-[1920px] mx-auto p-4 md:p-8 font-sans space-y-8">

            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                            <Fuel className="w-6 h-6 text-yellow-500" />
                        </div>
                        {t('fuel.title')}
                    </h1>
                    <p className="text-slate-400">{t('fuel.subtitle')}</p>
                </div>

                {/* Live Date/Time Widget */}
                <div className="hidden md:flex flex-col items-end bg-slate-800/30 px-4 py-2 rounded-xl border border-slate-700/50">
                    <span className="text-xl font-mono font-bold text-white">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                        {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs - Modern Pill Design */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { id: 'overview', icon: LayoutTemplate, label: 'Visão Geral', color: 'yellow' },
                    { id: 'abastecer', icon: Fuel, label: 'Registar Abastecimento', color: 'yellow' },
                    { id: 'tanque', icon: Droplets, label: 'Gestão de Tanque', color: 'emerald' },
                    { id: 'bp', icon: FileSpreadsheet, label: 'Cartões BP', color: 'green' },
                    { id: 'historico', icon: History, label: 'Histórico Completo', color: 'blue' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                        ${activeTab === tab.id
                                ? `bg-${tab.color}-500 text-black shadow-lg shadow-${tab.color}-500/20 ring-2 ring-${tab.color}-500/30`
                                : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                {/* Main Action Panel */}
                <div className="lg:col-span-2 space-y-6">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Hero Status Card */}
                            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Estado do Combustível</h2>
                                            <p className="text-slate-400">Visão geral do tanque e consumos</p>
                                        </div>
                                        {/* Tank Level Badge */}
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${percentage < 20 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                            <span className={`w-2 h-2 rounded-full ${percentage < 20 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                            <span className={`text-xs font-bold uppercase ${percentage < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {percentage < 20 ? 'Nível Crítico' : 'Nível Normal'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Droplets className="w-4 h-4 text-blue-500" />
                                                <span className="text-xs font-bold uppercase">Nível Atual</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-white font-bold text-2xl">{fuelTank.currentLevel}</p>
                                                <span className="text-xs text-slate-500">L</span>
                                            </div>
                                            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${percentage < 20 ? 'bg-red-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Truck className="w-4 h-4 text-emerald-500" />
                                                <span className="text-xs font-bold uppercase">Capacidade</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-white font-bold text-2xl">{fuelTank.capacity}</p>
                                                <span className="text-xs text-slate-500">L</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2 truncate">Max. Tanque</p>
                                        </div>

                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 relative group">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <Gauge className="w-4 h-4 text-yellow-500" />
                                                <span className="text-xs font-bold uppercase">Contador</span>
                                            </div>

                                            {isCalibrating ? (
                                                <div className="animate-in fade-in zoom-in duration-200">
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={calibrationValue}
                                                        onChange={e => setCalibrationValue(e.target.value)}
                                                        className="w-full bg-black/50 border border-yellow-500/50 rounded px-2 py-1 text-white font-mono text-lg mb-2 outline-none focus:ring-1 focus:ring-yellow-500"
                                                        placeholder="000000"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={confirmCalibration}
                                                            className="flex-1 bg-yellow-500 text-black text-[10px] font-bold py-1 rounded hover:bg-yellow-400"
                                                        >
                                                            SALVAR
                                                        </button>
                                                        <button
                                                            onClick={() => setIsCalibrating(false)}
                                                            className="px-2 bg-slate-800 text-slate-400 text-[10px] font-bold py-1 rounded hover:bg-slate-700"
                                                        >
                                                            X
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-white font-bold text-xl tracking-tighter">
                                                        {String(fuelTank.pumpTotalizer || 0).padStart(6, '0')}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-2">Leitura da Bomba</p>

                                                    {hasAccess(userRole, 'combustivel_calibrate') && (
                                                        <button
                                                            onClick={handleCalibrateTank}
                                                            className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                            title="Calibrar Contador"
                                                        >
                                                            <Settings className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                <BarChart3 className="w-4 h-4 text-purple-500" />
                                                <span className="text-xs font-bold uppercase">Preço Médio</span>
                                            </div>
                                            <p className="text-white font-bold text-2xl">
                                                {(fuelTank.averagePrice || 0).toFixed(3)}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2">€ / Litro</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions Grid */}
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">Ações Rápidas</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <button
                                    onClick={() => setActiveTab('abastecer')}
                                    className="p-6 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-yellow-500/50 rounded-2xl transition-all group text-left relative overflow-hidden"
                                >
                                    <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-4 group-hover:scale-110 transition-transform">
                                        <Fuel className="w-6 h-6" />
                                    </div>
                                    <span className="font-bold text-slate-200 block text-lg">Registar Saída</span>
                                    <span className="text-xs text-slate-500 mt-1 block">Abastecimento Viatura</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('tanque')}
                                    className="p-6 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 rounded-2xl transition-all group text-left"
                                >
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                                        <Truck className="w-6 h-6" />
                                    </div>
                                    <span className="font-bold text-slate-200 block text-lg">Registar Entrada</span>
                                    <span className="text-xs text-slate-500 mt-1 block">Abastecer Tanque</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('historico')}
                                    className="p-6 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl transition-all group text-left"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <span className="font-bold text-slate-200 block text-lg">Histórico</span>
                                    <span className="text-xs text-slate-500 mt-1 block">Consultar Movimentos</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* REFUEL TAB */}
                    {activeTab === 'abastecer' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                                    <Fuel className="w-5 h-5" />
                                </div>
                                {t('fuel.form.title')}
                            </h3>

                            <form onSubmit={handleInitiateRefuel} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t('fuel.form.driver')}</label>
                                        <select
                                            required
                                            value={refuelForm.driverId}
                                            onChange={e => setRefuelForm({ ...refuelForm, driverId: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-yellow-500/50 outline-none transition-all"
                                        >
                                            <option value="">{t('modal.choose_driver')}</option>
                                            {motoristas.map(m => (
                                                <option key={m.id} value={m.id}>{m.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t('fuel.form.vehicle')}</label>
                                        <input
                                            type="text"
                                            required
                                            value={refuelForm.vehicleId}
                                            onChange={e => setRefuelForm({ ...refuelForm, vehicleId: e.target.value })}
                                            list="viaturas-list"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-yellow-500/50 outline-none font-mono uppercase"
                                            placeholder="AA-00-BB"
                                        />
                                        <datalist id="viaturas-list">
                                            {viaturas.map(v => <option key={v.id} value={v.matricula} />)}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Centro de Custos</label>
                                    <select
                                        value={refuelForm.centroCustoId}
                                        onChange={e => setRefuelForm({ ...refuelForm, centroCustoId: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-yellow-500/50 outline-none transition-all"
                                    >
                                        <option value="">(Nenhum)</option>
                                        {centrosCustos.map(cc => (
                                            <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t('fuel.form.liters')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={refuelForm.liters}
                                                onChange={e => setRefuelForm({ ...refuelForm, liters: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-right text-white font-mono text-lg focus:border-yellow-500/50 outline-none"
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-sm">L</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t('fuel.form.km')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={refuelForm.km}
                                                onChange={e => setRefuelForm({ ...refuelForm, km: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-right text-white font-mono text-lg focus:border-yellow-500/50 outline-none"
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-sm">KM</span>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold py-5 rounded-xl transition-all shadow-xl shadow-yellow-500/20 active:scale-[0.98] text-sm uppercase tracking-wider flex items-center justify-center gap-2 mt-4">
                                    <Check className="w-5 h-5" />
                                    {t('fuel.form.submit')}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* TANK SUPPLY TAB */}
                    {activeTab === 'tanque' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <Truck className="w-5 h-5" />
                                </div>
                                Registar Entrada de Combustível
                            </h3>

                            <form onSubmit={handleRegisterSupply} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Fornecedor</label>
                                    <input
                                        type="text"
                                        required
                                        value={supplyForm.supplier}
                                        onChange={e => setSupplyForm({ ...supplyForm, supplier: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                                        placeholder="Nome da empresa fornecedora"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Litros Adicionados</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={supplyForm.litersAdded}
                                            onChange={e => setSupplyForm({ ...supplyForm, litersAdded: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-mono text-right focus:border-emerald-500/50 outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Preço por Litro (€)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.001"
                                            value={supplyForm.pricePerLiter}
                                            onChange={e => setSupplyForm({ ...supplyForm, pricePerLiter: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-mono text-right focus:border-emerald-500/50 outline-none"
                                            placeholder="0.000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Verificação de Segurança</label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 space-y-1">
                                            <span className="text-[10px] text-slate-500 uppercase">Leitura da Bomba</span>
                                            <input
                                                type="number"
                                                required
                                                min={fuelTank.pumpTotalizer || 0}
                                                value={supplyForm.pumpReading}
                                                onChange={e => setSupplyForm({ ...supplyForm, pumpReading: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono text-sm focus:border-emerald-500/50 outline-none"
                                                placeholder={String(fuelTank.pumpTotalizer || 0)}
                                            />
                                        </div>
                                        {hasAccess(userRole, 'combustivel_calibrate') && (
                                            <button
                                                type="button"
                                                onClick={handleCalibrateTank}
                                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors mt-5 border border-slate-700 hover:border-slate-600"
                                                title="Calibrar contador"
                                            >
                                                <Gauge className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    {isCalibrating && (
                                        <div className="mt-4 pt-4 border-t border-slate-800/50 animate-in slide-in-from-top-2">
                                            <div className="flex gap-2 items-center">
                                                <span className="text-xs text-yellow-500 font-bold uppercase whitespace-nowrap">Novo Valor:</span>
                                                <input
                                                    type="number"
                                                    value={calibrationValue}
                                                    onChange={e => setCalibrationValue(e.target.value)}
                                                    className="flex-1 bg-black/30 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                                                    placeholder="000000"
                                                />
                                                <button type="button" onClick={confirmCalibration} className="px-3 py-1 bg-yellow-500 text-black font-bold text-xs rounded hover:bg-yellow-400">DEFINIR</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-xl transition-all shadow-xl shadow-emerald-900/20 active:scale-[0.98] text-sm uppercase tracking-wider mt-4">
                                    Confirmar Entrada
                                </button>
                            </form>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'historico' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-right-4">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <History className="w-5 h-5 text-blue-400" />
                                Histórico de Movimentos
                            </h3>

                            <table className="w-full text-left border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="pb-4 pl-4">{t('fuel.history.date')}</th>
                                        <th className="pb-4">Operação</th>
                                        <th className="pb-4 text-center">Entidade</th>
                                        <th className="pb-4 text-right">Qtd.</th>
                                        <th className="pb-4 text-center">{t('fuel.history.status')}</th>
                                        <th className="pb-4 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {[
                                        ...fuelTransactions.map(t => ({ ...t, type: 'out', dateObj: new Date(t.timestamp) })),
                                        ...tankRefills.map(t => ({ ...t, type: 'in', dateObj: new Date(t.timestamp) }))
                                    ]
                                        .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
                                        .map((item: any) => {
                                            const isRefill = item.type === 'in';
                                            const driverName = !isRefill
                                                ? (motoristas.find(m => m.id === item.driverId)?.nome || 'Staff Office')
                                                : (item.staffName || 'Admin');

                                            return (
                                                <tr key={item.id} className="bg-slate-800/10 hover:bg-slate-800/30 transition-all group">
                                                    <td className="p-4 rounded-l-xl font-mono text-slate-400 text-xs border-y border-l border-white/5 group-hover:border-white/10">
                                                        <div>{new Date(item.timestamp).toLocaleDateString()}</div>
                                                        <div className="text-slate-600 mt-0.5">{new Date(item.timestamp).toLocaleTimeString().slice(0, 5)}</div>
                                                    </td>
                                                    <td className="p-4 border-y border-white/5 group-hover:border-white/10">
                                                        <span className={`font-bold block ${isRefill ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                            {isRefill ? 'Entrada (Tanque)' : 'Abastecimento'}
                                                        </span>
                                                        <span className="text-xs text-slate-500">{driverName}</span>
                                                    </td>
                                                    <td className="p-4 text-center border-y border-white/5 group-hover:border-white/10">
                                                        {isRefill ? (
                                                            <span className="px-2 py-1 rounded border border-emerald-500/20 text-emerald-500 text-xs font-bold">
                                                                {item.supplier || 'Fornecedor N/D'}
                                                            </span>
                                                        ) : (
                                                            <span className="font-mono text-xs font-bold text-slate-300 bg-black/20 px-2 py-1 rounded border border-white/5">
                                                                {item.vehicleId}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right border-y border-white/5 group-hover:border-white/10">
                                                        <div className={`font-bold ${isRefill ? 'text-emerald-500' : 'text-yellow-500'}`}>
                                                            {isRefill ? '+' : '-'}{item.liters || item.litersAdded} L
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center border-y border-white/5 group-hover:border-white/10">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isRefill || item.status === 'confirmed'
                                                            ? 'bg-emerald-500/10 text-emerald-400'
                                                            : 'bg-amber-500/10 text-amber-500'
                                                            }`}>
                                                            {isRefill ? 'Confirmado' : (item.status === 'confirmed' ? 'OK' : 'Pendente')}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 rounded-r-xl border-y border-r border-white/5 group-hover:border-white/10">
                                                        {hasAccess(userRole, 'combustivel_edit_history') && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Apagar registo?')) {
                                                                        isRefill ? deleteTankRefill(item.id) : deleteFuelTransaction(item.id);
                                                                    }
                                                                }}
                                                                className="text-slate-600 hover:text-red-400 p-1"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* BP TAB */}
                    {activeTab === 'bp' && (
                        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-right-4">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-green-600/10 flex items-center justify-center text-green-500">
                                        <FileSpreadsheet className="w-5 h-5" />
                                    </div>
                                    Gestão de Abastecimentos BP
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDownloadBPTemplate}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Template
                                    </button>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleImportBP}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors shadow-lg shadow-green-900/20">
                                            <Upload className="w-4 h-4" />
                                            Importar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {bpTransactions.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-separate border-spacing-y-2">
                                        <thead>
                                            <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                <th className="pb-4 pl-4">Data</th>
                                                <th className="pb-4">Viatura</th>
                                                <th className="pb-4">Estação</th>
                                                <th className="pb-4">Produto</th>
                                                <th className="pb-4 text-right">Qtd (L)</th>
                                                <th className="pb-4 text-right">Total (€)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {bpTransactions.map((row, idx) => (
                                                <tr key={idx} className="bg-slate-800/10 hover:bg-slate-800/30 transition-all">
                                                    <td className="p-4 rounded-l-xl font-mono text-slate-400 text-xs border-y border-l border-white/5">
                                                        {row.Data} <span className="text-slate-600">{row.Hora}</span>
                                                    </td>
                                                    <td className="p-4 border-y border-white/5 text-white font-bold">
                                                        {row.Matricula}
                                                    </td>
                                                    <td className="p-4 border-y border-white/5 text-slate-300">
                                                        {row.Estacao}
                                                    </td>
                                                    <td className="p-4 border-y border-white/5 text-slate-400">
                                                        {row.Produto}
                                                    </td>
                                                    <td className="p-4 text-right border-y border-white/5 text-white font-mono">
                                                        {Number(row.Quantidade).toFixed(2)}
                                                    </td>
                                                    <td className="p-4 rounded-r-xl text-right border-y border-r border-white/5 text-green-400 font-bold">
                                                        {Number(row.Total).toFixed(2)} €
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-700">
                                    <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-500">Nenhum dado importado.</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Baixe o template, preencha os dados e importe o ficheiro Excel.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Info Panel */}
                <div className="space-y-6">
                    {/* Tank Summary Card */}
                    <div className="bg-slate-800/20 border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-yellow-500/20"></div>

                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-24 h-24 rounded-full bg-slate-800 mb-4 flex items-center justify-center shadow-xl border-4 border-[#0f172a] p-4">
                                <Fuel className="w-10 h-10 text-yellow-500" />
                            </div>
                            <h3 className="font-bold text-xl text-white">Tanque Principal</h3>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-slate-400">Gasóleo Rodoviário</p>
                                {hasAccess(userRole, 'combustivel_calibrate') && (
                                    <button
                                        onClick={handleEditTank}
                                        className="p-1 hover:bg-slate-700 rounded-full text-slate-500 hover:text-white transition-colors"
                                        title="Editar Capacidade/Nível"
                                    >
                                        <Settings className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 mt-4">
                                <span className={`text-xs border px-3 py-1 rounded-full capitalize flex items-center gap-1 ${percentage < 20 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${percentage < 20 ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                    {percentage < 20 ? 'Reserva' : 'Operacional'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-700/50 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900/50 p-3 rounded-xl text-center">
                                    <span className="block text-2xl font-bold text-white">{tankRefills.length}</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Entradas</span>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded-xl text-center">
                                    <span className="block text-2xl font-bold text-white">{fuelTransactions.length}</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Saídas</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Transactions Feed */}
                    <div className="bg-slate-800/20 border border-slate-700/50 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-white text-sm uppercase flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-500" />
                                Últimos Movimentos
                            </h4>
                            <button onClick={() => setActiveTab('historico')} className="text-xs text-yellow-500 hover:text-yellow-400">Ver Todos</button>
                        </div>

                        <div className="space-y-3">
                            {recentTransactions.map(trans => {
                                const driverName = motoristas.find(m => m.id === trans.driverId)?.nome.split(' ')[0] || 'Motorista';
                                return (
                                    <div key={trans.id} className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors cursor-default">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-yellow-500/10 text-yellow-500">
                                                - {trans.liters} L
                                            </span>
                                            <span className="text-[10px] text-slate-500 text-right">{new Date(trans.timestamp).toLocaleTimeString().slice(0, 5)}</span>
                                        </div>
                                        <p className="text-sm font-bold text-white mt-1">{driverName}</p>
                                        <p className="text-xs text-slate-400 font-mono">{trans.vehicleId}</p>
                                    </div>
                                );
                            })}
                            {recentTransactions.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sem movimentos recentes.</p>
                            )}
                        </div>

                        <button
                            onClick={() => setActiveTab('abastecer')}
                            className="w-full mt-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                        >
                            Novo Abastecimento
                        </button>
                    </div>
                </div>

            </div>

            {/* Edit Tank Modal */}
            {isEditingTank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Editar Tanque</h3>
                        <form onSubmit={saveTankChanges} className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 font-bold uppercase">Capacidade Total (L)</label>
                                <input
                                    type="number"
                                    required
                                    value={editTankForm.capacity}
                                    onChange={e => setEditTankForm({ ...editTankForm, capacity: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 font-bold uppercase">Nível Atual (L)</label>
                                <input
                                    type="number"
                                    required
                                    value={editTankForm.currentLevel}
                                    onChange={e => setEditTankForm({ ...editTankForm, currentLevel: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                />
                                <p className="text-[10px] text-yellow-500 mt-1">
                                    Atenção: Alterar manualmente o nível pode dessincronizar o histórico de abastecimentos.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 font-bold uppercase">Preço Médio (€/L)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    required
                                    value={editTankForm.averagePrice}
                                    onChange={e => setEditTankForm({ ...editTankForm, averagePrice: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingTank(false)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Dual Auth Modal */}
            {authModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                        <button
                            onClick={() => setAuthModal({ isOpen: false, step: 1, adminPassword: '', driverPin: '', error: '' })}
                            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <Trash2 className="w-5 h-5 rotate-45" />
                        </button>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-yellow-500 border border-yellow-500/20">
                                {authModal.step === 1 ? <Fuel className="w-8 h-8" /> : <Truck className="w-8 h-8" />}
                            </div>
                            <h3 className="text-2xl font-bold text-white">
                                {authModal.step === 1 ? 'Confirmação de Staff' : 'Confirmação do Motorista'}
                            </h3>
                            <p className="text-slate-400 mt-2">
                                {authModal.step === 1
                                    ? `Por favor insira ${userRole === 'admin' ? 'sua password' : 'seu PIN'} para continuar.`
                                    : 'Por favor, peça ao motorista para inserir o PIN dele.'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            {authModal.step === 1 ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                        {userRole === 'admin' ? 'Password de Administrador' : 'PIN de Acesso'}
                                    </label>
                                    <input
                                        type={userRole === 'admin' ? 'password' : 'password'}
                                        inputMode={userRole === 'admin' ? 'text' : 'numeric'}
                                        value={authModal.adminPassword}
                                        onChange={e => setAuthModal(prev => ({ ...prev, adminPassword: e.target.value, error: '' }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-center text-2xl font-mono tracking-widest focus:border-yellow-500/50 outline-none transition-all"
                                        placeholder={userRole === 'admin' ? '••••••••' : '••••'}
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                        PIN do Motorista
                                    </label>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        value={authModal.driverPin}
                                        onChange={e => setAuthModal(prev => ({ ...prev, driverPin: e.target.value, error: '' }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-center text-2xl font-mono tracking-widest focus:border-yellow-500/50 outline-none transition-all"
                                        placeholder="••••••"
                                        autoFocus
                                    />
                                </div>
                            )}

                            {authModal.error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center animate-shake">
                                    {authModal.error}
                                </div>
                            )}

                            <button
                                onClick={handleDualAuth}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-[0.98]"
                            >
                                {authModal.step === 1 ? 'Continuar' : 'Confirmar Abastecimento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
