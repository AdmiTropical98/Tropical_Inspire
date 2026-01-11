import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
    LayoutTemplate, Clock, FileText, Share2, AlertTriangle,
    Send, Car, Sun, Navigation, Calendar,
    Check, Fuel, Settings2
} from 'lucide-react';
import MyScheduleView from './MyScheduleView';
import DraggableZone from '../common/DraggableZone';
import { useLayout } from '../../contexts/LayoutContext';
import NavigationApp from './NavigationApp';
import TagRegistrationModal from '../common/TagRegistrationModal';




export default function CentralMotorista() {
    const { t } = useTranslation();
    const { currentUser, userRole, userPhoto } = useAuth();
    const {
        servicos,
        notifications,
        addNotification,
        updateNotification,
        confirmRefuel,
        updateMotorista,
        cartrackVehicles
    } = useWorkshop();

    const [activeTab, setActiveTab] = useState<'overview' | 'viatura' | 'pedidos' | 'recibos' | 'reportar' | 'escala' | 'abastecimentos' | 'navegacao'>('overview');

    // Forms State
    const [requestForm, setRequestForm] = useState({ type: 'ferias', description: '' });
    const [reportForm, setReportForm] = useState({ type: 'acidente', description: '' });

    const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);

    // Layout Context
    const { isEditMode, toggleEditMode } = useLayout();

    // ... items definitions for Dashboard ...


    // ...





    // Shift Edit State
    const [editingShift, setEditingShift] = useState(false);
    const [tempShift, setTempShift] = useState({ start: '08:00', end: '17:00' });


    // State for Tag Registration Modal
    const [showTagModal, setShowTagModal] = useState(false);

    useEffect(() => {
        // Show modal if driver has no tag registered
        if (userRole === 'motorista' && currentUser && !('cartrackKey' in currentUser && (currentUser as any).cartrackKey)) {
            setShowTagModal(true);
        }
    }, [userRole, currentUser]);

    const handleTagSave = async (tagId: string) => {
        try {
            if (currentUser && userRole === 'motorista') {
                const updatedDriver = {
                    ...currentUser as any,
                    cartrackKey: tagId
                };
                await updateMotorista(updatedDriver);
                setShowTagModal(false);
                // AuthContext update would be ideal here, but WorkshopContext usually re-fetches
                // We reload to ensure AuthContext picks up the new key from localStorage/DB
                window.location.reload();
            }
        } catch (err) {
            console.error("Error saving tag:", err);
            throw err; // Let modal handle error display
        }
    };

    // Auto-open Fuel Tab via Effect - Watch for pending requests
    const [lastSeenNotificationCount, setLastSeenNotificationCount] = useState(0);

    // Mobile Navigation Handling (Back Button)
    useEffect(() => {
        if (activeTab === 'escala') {
            // Push state when entering 'escala'
            window.history.pushState({ tab: 'escala' }, '', '#escala');
        }

        const handlePopState = (_event: PopStateEvent) => {
            // If we are in 'escala' and user hits back, we go back to 'overview'
            if (activeTab === 'escala') {
                setActiveTab('overview');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeTab]);

    useEffect(() => {
        // Simple check: if we have ANY pending fuel request, force open tab.
        const pendingFuel = notifications.find((n: any) =>
            n.type === 'fuel_confirmation_request' &&
            n.status === 'pending' &&
            (n.response?.driverId === currentUser?.id || !n.response?.driverId)
        );

        if (pendingFuel && activeTab !== 'abastecimentos') {
            if (notifications.length > lastSeenNotificationCount) {
                setActiveTab('abastecimentos');
            }
        }
        setLastSeenNotificationCount(notifications.length);
    }, [notifications, currentUser, activeTab, lastSeenNotificationCount]);



    // Fetch Weather (Lisbon default for now)
    useState(() => {
        fetch('https://api.open-meteo.com/v1/forecast?latitude=38.7167&longitude=-9.1333&current=temperature_2m,weather_code&timezone=auto')
            .then(res => res.json())
            .then(data => {
                const code = data.current.weather_code;
                let desc = 'Céu Limpo';
                if (code > 3) desc = 'Nublado';
                if (code > 50) desc = 'Chuva';
                setWeather({
                    temp: Math.round(data.current.temperature_2m),
                    desc
                });
            })
            .catch(err => console.error('Weather error:', err));
    });

    const saveShift = async () => {
        if (!currentUser && userRole === 'admin') {
            alert('Modo Admin: Isto é apenas uma simulação. Como administrador, não tens um turno atribuído na base de dados de motoristas.');
            setEditingShift(false);
            return;
        }

        if (currentUser && userRole === 'motorista') {
            try {
                const updatedDriver = {
                    ...currentUser as any,
                    turnoInicio: tempShift.start,
                    turnoFim: tempShift.end
                };
                await updateMotorista(updatedDriver);
                // Ideally also update AuthContext currentUser, but WorkshopContext update eventually propagates if we re-login. 
                // For immediate UI feedback we might need to force it or rely on Realtime.
                alert('Turno atualizado com sucesso!');
                setEditingShift(false);
                // Force reload to see changes if simple state update isn't enough (AuthContext usually static)
                window.location.reload();
            } catch (err) {
                console.error("Erro ao gravar turno:", err);
                alert('Erro ao gravar turno. Verifica se a base de dados tem as colunas "turno_inicio" e "turno_fim".');
            }
        }
    };

    // Real Data Integration
    // const { servicos, notifications, confirmRefuel, updateNotification } = useWorkshop(); // Already destructured above

    // 1. My Requests (Filtered from System Alerts for now, ideally strictly typed)
    const myRequests = notifications
        .filter((n: any) => n.type === 'system_alert' && n.data.message?.includes(currentUser?.nome || ''))
        .map((n: any) => ({
            id: n.id,
            type: n.data.title?.replace('Novo Pedido: ', '') || 'Outros',
            date: new Date(n.timestamp).toLocaleDateString(),
            status: n.status,
            desc: n.data.message
        }));

    // 2. My Vehicle
    // Since there is no direct link in DB yet, we look for a vehicle that might be assigned or null
    // For now, we assume null to avoid showing fake data as requested.
    // Future: const myVehicle = viaturas.find(v => v.motoristaId === currentUser.id);
    const myVehicle: any = null;

    // 3. Stats
    const myServicesCount = servicos.filter((s: any) => s.motoristaId === currentUser?.id).length;
    // Rating not yet implemented in DB, defaulting to placeholder or 0
    // @ts-ignore
    const myRating = currentUser?.rating || 0; // Assuming rating might be added to user type later

    // 4. Next Service
    const nextService = servicos
        .filter((s: any) => s.motoristaId === currentUser?.id && !s.concluido)
        .sort((a: any, b: any) => new Date(a.hora).getTime() - new Date(b.hora).getTime())[0];

    // 5. My Schedule (Future services)
    const mySchedule = servicos
        .filter((s: any) => s.motoristaId === currentUser?.id)
        .sort((a: any, b: any) => new Date(a.hora).getTime() - new Date(b.hora).getTime());


    const handleSubmitRequest = (e: React.FormEvent) => {
        e.preventDefault();
        addNotification({
            id: crypto.randomUUID(),
            type: 'system_alert',
            data: {
                title: `Novo Pedido: ${requestForm.type}`,
                message: `${currentUser?.nome} enviou um pedido: ${requestForm.description}`,
                priority: 'normal'
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        alert(t('central.success.request'));
        setRequestForm({ ...requestForm, description: '' });
    };

    const handleSubmitReport = (e: React.FormEvent) => {
        e.preventDefault();
        addNotification({
            id: crypto.randomUUID(),
            type: 'system_alert',
            data: {
                title: `Reporte de Motorista: ${reportForm.type}`,
                message: `${currentUser?.nome} reportou: ${reportForm.description}`,
                priority: 'high'
            },
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        alert(t('central.success.report'));
        setReportForm({ ...reportForm, description: '' });
    };

    // Dashboard Widgets
    const dashboardWidgets = [
        {
            id: 'next-service', content: (
                <div className={`bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 h-full flex flex-col`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Navigation className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Próximo Serviço</span>
                    </div>
                    {nextService ? (
                        <>
                            <p className="text-white font-bold text-lg">{nextService.hora}</p>
                            <p className="text-xs text-slate-500 truncate">{nextService.origem} &rarr; {nextService.destino}</p>
                        </>
                    ) : (
                        <p className="text-slate-500 text-sm italic mt-auto">Sem serviços</p>
                    )}
                </div>
            )
        },
        {
            id: 'vehicle', content: (
                <div className={`bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 h-full flex flex-col`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Car className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Viatura</span>
                    </div>
                    {myVehicle ? (
                        <>
                            <p className="text-white font-bold text-lg">{myVehicle.matricula}</p>
                            <p className="text-xs text-slate-500 truncate">{myVehicle.modelo}</p>
                        </>
                    ) : (
                        <p className="text-slate-500 text-sm italic mt-auto">N/A</p>
                    )}
                </div>
            )
        },
        {
            id: 'weather', content: (
                <div className={`bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 h-full flex flex-col`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Sun className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Meteorologia</span>
                    </div>
                    {weather ? (
                        <>
                            <p className="text-white font-bold text-lg">{weather.temp}°C</p>
                            <p className="text-xs text-slate-500 capitalize">{weather.desc}</p>
                        </>
                    ) : (
                        <>
                            <p className="text-white font-bold text-lg">--°C</p>
                            <p className="text-xs text-slate-500 mt-auto">A carregar...</p>
                        </>
                    )}
                </div>
            )
        },
        {
            id: 'shift', content: (
                <div className={`bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 relative group h-full flex flex-col`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Turno</span>
                    </div>
                    {/* Note: In Edit Mode DraggableZone disables interaction, so we can only edit shift when NOT in edit mode */}
                    {!isEditMode && (
                        <button
                            onClick={() => setEditingShift(true)}
                            className="absolute top-2 right-2 p-1.5 bg-slate-800 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                            style={{ zIndex: 50 }}
                        >
                            <Settings2 className="w-3 h-3" />
                        </button>
                    )}

                    {editingShift ? (
                        <div className="flex flex-col gap-2 mt-auto relative z-50">
                            <div className="flex items-center gap-1">
                                <input
                                    type="time"
                                    value={tempShift.start}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={e => setTempShift({ ...tempShift, start: e.target.value })}
                                    className="bg-slate-800 text-white text-xs rounded p-1 w-full outline-none border border-slate-700 focus:border-blue-500"
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="time"
                                    value={tempShift.end}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={e => setTempShift({ ...tempShift, end: e.target.value })}
                                    className="bg-slate-800 text-white text-xs rounded p-1 w-full outline-none border border-slate-700 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex gap-1 justify-end">
                                <button onClick={() => setEditingShift(false)} className="px-2 py-1 bg-slate-700 rounded text-[10px] text-white">Cancelar</button>
                                <button onClick={saveShift} className="px-2 py-1 bg-blue-600 rounded text-[10px] text-white">Gravar</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-white font-bold text-lg">{tempShift.start} - {tempShift.end}</p>
                            <p className="text-xs text-slate-500 mt-auto">Horário Regular</p>
                        </>
                    )}
                </div>
            )
        }
    ];

    // Navigation Tabs
    const navTabs = [
        { id: 'overview', icon: LayoutTemplate, label: 'Visão Geral', color: 'blue' },
        { id: 'escala', icon: Calendar, label: 'Minha Escala', color: 'blue' },
        { id: 'viatura', icon: Car, label: 'Minha Viatura', color: 'indigo' },
        { id: 'pedidos', icon: Share2, label: t('central.tab.requests'), color: 'purple' },
        { id: 'abastecimentos', icon: Fuel, label: 'Abastecimentos', color: 'orange' },
        { id: 'navegacao', icon: Navigation, label: 'Navegação', color: 'blue' },
        { id: 'recibos', icon: FileText, label: t('central.tab.payslips'), color: 'emerald' },
        { id: 'reportar', icon: AlertTriangle, label: t('central.tab.report'), color: 'red' }
    ].map(tab => ({
        id: tab.id,
        content: (
            <button
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                ${activeTab === tab.id
                        ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-900/20 ring-2 ring-${tab.color}-500/30`
                        : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
            >
                <tab.icon className="w-4 h-4" />
                {tab.label}
            </button>
        )
    }));

    return (
        <div className="h-full overflow-y-auto custom-scrollbar max-w-7xl mx-auto p-4 md:p-8 font-sans pb-24">
            {/* Header with improved styling */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <LayoutTemplate className="w-6 h-6 text-blue-500" />
                        </div>
                        {t('central.title')}
                    </h1>
                    <p className="text-slate-400">{t('central.subtitle')}</p>
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

            {/* Navigation Tabs - Modern Pill Design - Customizable */}
            <DraggableZone
                zoneId="central_tabs"
                items={navTabs}
                className="mb-8 overflow-x-auto pb-2 scrollbar-hide"
                layout="flex"
            />

            {/* Tag Registration Modal */}
            {showTagModal && <TagRegistrationModal onSave={handleTagSave} />}

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                {/* NEW TAB: ESCALA - FULL WIDTH IF ACTIVE */}
                {activeTab === 'escala' && (
                    <div className="lg:col-span-3">
                        <MyScheduleView
                            services={mySchedule}
                            onBack={() => setActiveTab('overview')}
                        />
                    </div>
                )}

                {/* NEW TAB: NAVEGACAO - FULL SCREEN OVERLAY */}
                {activeTab === 'navegacao' && (
                    <NavigationApp
                        driverLocation={(() => {
                            const myCV = (currentUser as any)?.currentVehicle;
                            const v = cartrackVehicles.find(cv => cv.registration === myCV);
                            return v ? [v.latitude, v.longitude] : [38.7223, -9.1393];
                        })()}
                        destination={nextService?.destino}
                        onBack={() => setActiveTab('overview')}
                    />
                )}


                {/* Main Action Panel */}
                <div className={`lg:col-span-2 space-y-6 ${activeTab === 'escala' ? 'hidden' : ''}`}>

                    {/* NEW TAB: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">



                            {/* Hero Status Card */}
                            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/10 rounded-3xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Olá, {currentUser?.nome?.split(' ')[0] || (userRole === 'admin' ? 'Miguel' : 'Motorista')}</h2>
                                            <p className="text-slate-400">Pronto para o serviço de hoje?</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span className="text-xs font-bold text-emerald-400 uppercase">Online</span>
                                        </div>
                                    </div>

                                    {/* Mobile Edit Button - Now toggles Global context */}
                                    <div className="flex justify-end mb-4">
                                        <button
                                            onClick={toggleEditMode}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isEditMode ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                                        >
                                            {isEditMode ? 'Terminar Edição' : 'Personalizar Layout'}
                                        </button>
                                    </div>

                                    <DraggableZone
                                        zoneId="central_driver_overview"
                                        items={dashboardWidgets}
                                    />

                                </div>
                            </div>

                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
                                    <div className="text-slate-400 text-xs mb-1">Serviços Hoje</div>
                                    <div className="text-2xl font-bold text-white">{myServicesCount}</div>
                                </div>
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
                                    <div className="text-slate-400 text-xs mb-1">Avaliação</div>
                                    <div className="text-2xl font-bold text-amber-500 flex items-center gap-1">
                                        4.9 <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                                    </div>
                                </div>
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
                                    <div className="text-slate-400 text-xs mb-1">Faltas</div>
                                    <div className="text-2xl font-bold text-green-500">0</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EXISTING TABS */}
                    {activeTab === 'viatura' && (
                        <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Car className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">Minha Viatura</h3>
                            <p className="text-slate-400 max-w-md mx-auto">Funcionalidade em desenvolvimento. Em breve poderás ver o estado, quilómetros e consumos da tua viatura atribuída.</p>
                        </div>
                    )}


                    {activeTab === 'abastecimentos' && (
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Fuel className="w-5 h-5 text-orange-400" />
                                Confirmação de Abastecimentos
                            </h3>

                            {notifications.filter((n: any) =>
                                n.type === 'fuel_confirmation_request' &&
                                n.status === 'pending' &&
                                (n.response?.driverId === currentUser?.id || !n.response?.driverId)
                            ).length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    <p>Não existem pedidos de confirmação pendentes.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {notifications.filter((n: any) =>
                                        n.type === 'fuel_confirmation_request' &&
                                        n.status === 'pending' &&
                                        (n.response?.driverId === currentUser?.id || !n.response?.driverId)
                                    ).map((n: any) => (
                                        <div key={n.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-orange-500/10 rounded-lg text-orange-500">
                                                    <Fuel className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-white">Abastecimento Viatura</h4>
                                                        <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full font-medium">Pendente</span>
                                                    </div>
                                                    <p className="text-slate-400 text-sm mt-1">
                                                        <span className="text-white font-medium">{n.data.liters} Litros</span> na viatura <span className="text-white font-medium">{n.data.licensePlate}</span>
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Solicitado por: <span className="text-slate-400">{n.data.staffId || 'Staff'}</span> • {new Date(n.timestamp).toLocaleDateString()} {new Date(n.timestamp).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            if (!n.response?.serviceId) {
                                                                alert('Erro: ID do serviço em falta.');
                                                                return;
                                                            }

                                                            if (window.confirm('Confirma que este abastecimento foi realizado?')) {
                                                                // Confirm transaction
                                                                const res = await confirmRefuel(n.response.serviceId);
                                                                if (res && res.error) {
                                                                    alert('Erro ao confirmar transação: ' + JSON.stringify(res.error));
                                                                    return;
                                                                }

                                                                // Update Notification
                                                                const { error } = await updateNotification({ ...n, status: 'approved' });
                                                                if (error) {
                                                                    console.error('Update Notif Error:', error);
                                                                    alert('Falha ao atualizar notificação: ' + error.message);
                                                                }
                                                            }
                                                        } catch (err: any) {
                                                            console.error('Error confirming:', err);
                                                            alert('Erro crítico: ' + (err.message || 'Erro desconhecido'));
                                                        }
                                                    }}
                                                    className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Aceitar
                                                </button>
                                                <button
                                                    className="flex-1 md:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Rejeitar/Reportar este pedido? Isto irá remover o pedido da lista.')) {
                                                            try {
                                                                const { error } = await updateNotification({ ...n, status: 'rejected' });
                                                                if (error) throw error;
                                                            } catch (err: any) {
                                                                alert('Erro ao rejeitar: ' + err.message);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Reportar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'pedidos' && (
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-purple-400" />
                                {t('central.requests.title')}
                            </h3>
                            <form onSubmit={handleSubmitRequest} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">{t('common.type')}</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        value={requestForm.type}
                                        onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}
                                    >
                                        <option value="ferias">Férias</option>
                                        <option value="material">Material / Fardamento</option>
                                        <option value="adiantamento">Adiantamento Salarial</option>
                                        <option value="declaracao">Declaração</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">{t('common.description')}</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        value={requestForm.description}
                                        onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                                        placeholder="Descreva o seu pedido..."
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Send className="w-4 h-4" />
                                        {t('common.submit')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'recibos' && (
                        <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">Recibos de Vencimento</h3>
                            <p className="text-slate-400 max-w-md mx-auto">Visualiza e descarrega os teus recibos de vencimento. Disponível brevemente com integração PHC.</p>
                        </div>
                    )}

                    {activeTab === 'reportar' && (
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                Reportar Incidente
                            </h3>
                            <form onSubmit={handleSubmitReport} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Incidente</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                        value={reportForm.type}
                                        onChange={(e) => setReportForm({ ...reportForm, type: e.target.value })}
                                    >
                                        <option value="acidente">Acidente / Sinistro</option>
                                        <option value="avaria">Avaria Mecânica</option>
                                        <option value="atraso">Atraso / Trânsito</option>
                                        <option value="cliente">Problema com Cliente</option>
                                        <option value="outros">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Descrição Detalhada</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                        value={reportForm.description}
                                        onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                                        placeholder="Descreva o que aconteceu..."
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                        Reportar Imediatamente
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                </div>

                {/* Sidebar - Always visible except when Escala is active and takes full width */}
                <div className={`space-y-6 ${activeTab === 'escala' ? 'hidden lg:block lg:col-span-1' : ''} ${activeTab === 'escala' ? 'hidden' : ''}`}>

                    {/* User Profile Card */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col items-center">
                        <div className="relative mb-4">
                            <div className="w-24 h-24 rounded-full bg-slate-900 border-4 border-slate-800 overflow-hidden">
                                {userPhoto ? (
                                    <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.nome || 'User')}&background=0D8ABC&color=fff`} alt="Profile" className="w-full h-full object-cover" />
                                )}                            </div>
                            <div className="absolute bottom-0 right-0 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-800"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{currentUser?.nome}</h3>
                        <p className="text-slate-400 text-sm mb-4">Motorista Profissional</p>

                        <div className="w-full grid grid-cols-1 gap-2 text-center text-sm">
                            {/* ID Removed as requested */}
                            <div className="bg-slate-900/50 p-2 rounded-lg">
                                <span className="block text-slate-500 text-xs uppercase">Carta</span>
                                <span className="font-mono text-white">B, C</span>
                            </div>
                            {(currentUser as any)?.cartrackKey && (
                                <div className="bg-slate-900/50 p-2 rounded-lg border border-blue-500/20">
                                    <span className="block text-blue-500 text-[10px] font-bold uppercase mb-0.5">Chave Identificação</span>
                                    <span className="font-mono text-white text-xs">{(currentUser as any).cartrackKey}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notifications / Requests Status */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Share2 className="w-4 h-4" /> Meus Pedidos
                        </h3>
                        <div className="space-y-3">
                            {myRequests.length > 0 ? myRequests.map((req: any) => (
                                <div key={req.id} className="bg-slate-900/50 p-3 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${req.status === 'approved' ? 'bg-emerald-500' : req.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                        <div>
                                            <p className="text-sm font-bold text-white capitalize">{req.type}</p>
                                            <p className="text-xs text-slate-500">{req.date}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 text-sm py-4">Sem pedidos recentes.</p>
                            )}
                        </div>
                    </div>

                    {/* Documents Expiring */}
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Documentos
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500/10 p-2 rounded-lg">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Carta de Condução</p>
                                        <p className="text-xs text-slate-500">Válida até 2026</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500/10 p-2 rounded-lg">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">CAM</p>
                                        <p className="text-xs text-slate-500">Válido até 2025</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
