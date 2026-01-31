import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
    LayoutTemplate, Clock, FileText, Share2, AlertTriangle,
    Send, Car, Sun, Navigation, Calendar,
    Fuel, Settings2, ArrowRight,
    CloudSun, CloudFog, CloudLightning, CloudRain, Snowflake, Star
} from 'lucide-react';
import MyScheduleView from './MyScheduleView';
import NavigationApp from './NavigationApp';
import TagRegistrationModal from '../../components/common/TagRegistrationModal';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../contexts/PermissionsContext';
import { cleanTagId } from '../../services/cartrack';

export default function CentralMotoristas() {
    const { t } = useTranslation();
    const { currentUser, userRole, refreshCurrentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const {
        servicos,
        notifications,
        addNotification,
        confirmRefuel,
        updateMotorista,
        cartrackVehicles,
        geofences,
        updateServico,
        refreshData
    } = useWorkshop();

    // Auto-refresh data every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const [activeTab, setActiveTab] = useState<'overview' | 'viatura' | 'pedidos' | 'recibos' | 'reportar' | 'escala' | 'abastecimentos' | 'navegacao'>('overview');

    // Forms State
    const [requestForm, setRequestForm] = useState({ type: 'ferias', description: '' });
    const [reportForm, setReportForm] = useState({ type: 'acidente', description: '' });

    const [weather, setWeather] = useState<{
        current: { temp: number; desc: string; code: number };
        daily: Array<{ day: string; min: number; max: number; code: number }>
    } | null>(null);

    // Shift Edit State
    const [editingShift, setEditingShift] = useState(false);
    const [tempShift, setTempShift] = useState({ start: '08:00', end: '17:00' });

    // State for Tag Registration Modal
    const [showTagModal, setShowTagModal] = useState(false);

    useEffect(() => {
        if (userRole === 'motorista' && currentUser) {
            const driver = currentUser as any;
            const hasTag = (driver.cartrackKey && driver.cartrackKey.trim() !== '') ||
                (driver.cartrack_key && driver.cartrack_key.trim() !== '');

            if (!hasTag) {
                setShowTagModal(true);
            }
        }
    }, [userRole, currentUser]);

    useEffect(() => {
        if (currentUser && ('turnoInicio' in currentUser || 'turno_inicio' in currentUser)) {
            const driver = currentUser as any;
            setTempShift({
                start: driver.turnoInicio || driver.turno_inicio || '08:00',
                end: driver.turnoFim || driver.turno_fim || '17:00'
            });
        }
    }, [currentUser]);

    const handleTagSave = async (tagId: string) => {
        try {
            if (currentUser && userRole === 'motorista') {
                const { error } = await supabase
                    .from('motoristas')
                    .update({ cartrack_key: tagId })
                    .eq('id', currentUser.id);

                if (error) throw error;

                await refreshCurrentUser();
                setShowTagModal(false);
                window.location.reload();
            }
        } catch (err) {
            console.error("Error saving tag:", err);
            throw err;
        }
    };

    // Auto-open Fuel Tab via Effect
    const [lastSeenNotificationCount, setLastSeenNotificationCount] = useState(0);

    // Mobile Navigation Handling
    useEffect(() => {
        if (activeTab === 'escala') {
            window.history.pushState({ tab: 'escala' }, '', '#escala');
        }

        const handlePopState = (_event: PopStateEvent) => {
            if (activeTab === 'escala') {
                setActiveTab('overview');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeTab]);

    useEffect(() => {
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

    // Fetch Weather
    useState(() => {
        fetch('https://api.open-meteo.com/v1/forecast?latitude=38.7167&longitude=-9.1333&current=temperature_2m,weather_code&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto')
            .then(res => res.json())
            .then(data => {
                const currentCode = data.current.weather_code;

                const getWeatherDesc = (code: number) => {
                    if (code === 0) return 'Céu Limpo';
                    if (code <= 3) return 'Parc. Nublado';
                    if (code <= 48) return 'Nevoeiro';
                    if (code <= 55) return 'Chuvisco';
                    if (code <= 67) return 'Chuva';
                    if (code <= 77) return 'Neve';
                    if (code <= 82) return 'Aguaceiros';
                    if (code <= 99) return 'Trovoada';
                    return 'Vento';
                };

                const daily = data.daily.time.slice(1, 4).map((date: string, index: number) => ({
                    day: new Date(date).toLocaleDateString('pt-PT', { weekday: 'short' }),
                    min: Math.round(data.daily.temperature_2m_min[index + 1]),
                    max: Math.round(data.daily.temperature_2m_max[index + 1]),
                    code: data.daily.weathercode[index + 1]
                }));

                setWeather({
                    current: {
                        temp: Math.round(data.current.temperature_2m),
                        desc: getWeatherDesc(currentCode),
                        code: currentCode
                    },
                    daily
                });
            })
            .catch(err => console.error('Weather error:', err));
    });

    const saveShift = async () => {
        if (!currentUser && userRole === 'admin') {
            alert('Modo Admin: Isto é apenas uma simulação.');
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
                alert('Turno atualizado com sucesso!');
                setEditingShift(false);
                window.location.reload();
            } catch (err) {
                console.error("Erro ao gravar turno:", err);
                alert('Erro ao gravar turno.');
            }
        }
    };

    // Vehicle Detection Logic
    const myVehicle = (() => {
        if (!currentUser) return null;
        const driver = currentUser as any;

        // 1. Try to find by Cartrack Key (Tag)
        const userKey = driver.cartrackKey || driver.cartrack_key;
        if (userKey) {
            const cleanKey = cleanTagId(userKey);
            const taggedVehicle = cartrackVehicles.find(v =>
                v.tagId && cleanTagId(v.tagId) === cleanKey
            );
            if (taggedVehicle) return taggedVehicle;
        }

        // 2. Fallback: Try to find by assigned 'currentVehicle' string (Plate)
        if (driver.currentVehicle) {
            const normalize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const assignedVehicle = cartrackVehicles.find(v =>
                normalize(v.registration) === normalize(driver.currentVehicle)
            );
            if (assignedVehicle) return assignedVehicle;
        }

        return null;
    })();

    const myServicesCount = servicos.filter((s: any) => s.motoristaId === currentUser?.id).length;
    const nextService = servicos
        .filter((s: any) => s.motoristaId === currentUser?.id && !s.concluido)
        .sort((a: any, b: any) => new Date(a.hora).getTime() - new Date(b.hora).getTime())[0];

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

    const getWeatherIcon = (code: number, className = "w-6 h-6") => {
        if (code === 0) return <Sun className={`${className} text-yellow-400`} />;
        if (code <= 3) return <CloudSun className={`${className} text-yellow-200`} />;
        if (code <= 48) return <CloudFog className={`${className} text-slate-300`} />;
        if (code <= 67) return <CloudRain className={`${className} text-blue-300`} />;
        if (code <= 77) return <Snowflake className={`${className} text-white`} />;
        if (code <= 82) return <CloudRain className={`${className} text-blue-400`} />;
        if (code <= 99) return <CloudLightning className={`${className} text-purple-300`} />;
        return <Sun className={className} />;
    };

    const getWeatherBackground = (code: number) => {
        if (code === 0) return 'from-[#0083B0] to-[#00B4DB]';
        if (code <= 3) return 'from-slate-500 to-slate-600';
        if (code <= 48) return 'from-slate-600 to-slate-700';
        if (code <= 67) return 'from-slate-700 to-slate-800';
        if (code <= 77) return 'from-blue-800 to-slate-800';
        if (code <= 99) return 'from-indigo-900 to-slate-900';
        return 'from-[#0083B0] to-[#00B4DB]';
    };

    const navTabs = [
        { id: 'overview', icon: LayoutTemplate, label: 'Visão Geral', color: 'blue' },
        { id: 'escala', icon: Calendar, label: 'Minha Escala', color: 'blue' },
        { id: 'viatura', icon: Car, label: 'Minha Viatura', color: 'indigo' },
        { id: 'pedidos', icon: Share2, label: t('central.tab.requests'), color: 'purple' },
        { id: 'abastecimentos', icon: Fuel, label: 'Abastecimentos', color: 'orange' },
        { id: 'navegacao', icon: Navigation, label: 'Navegação', color: 'blue' },
        { id: 'recibos', icon: FileText, label: t('central.tab.payslips'), color: 'emerald' },
        { id: 'reportar', icon: AlertTriangle, label: t('central.tab.report'), color: 'red' }
    ].filter(tab => {
        if (tab.id === 'navegacao') return hasAccess(userRole, 'central_navegacao');
        if (tab.id === 'recibos') return hasAccess(userRole, 'central_recibos');
        return true;
    });

    const getActiveClasses = (color: string) => {
        switch (color) {
            case 'blue': return 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30';
            case 'indigo': return 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 ring-2 ring-indigo-500/30';
            case 'purple': return 'bg-purple-600 text-white shadow-lg shadow-purple-900/20 ring-2 ring-purple-500/30';
            case 'orange': return 'bg-orange-600 text-white shadow-lg shadow-orange-900/20 ring-2 ring-orange-500/30';
            case 'emerald': return 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/30';
            case 'red': return 'bg-red-600 text-white shadow-lg shadow-red-900/20 ring-2 ring-red-500/30';
            default: return 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30';
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-4">
                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                                    {t('central.title')}
                                </span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium">{t('central.subtitle')}</p>
                        </div>
                        <div className="hidden md:flex flex-col items-end bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-700/50 shadow-sm">
                            <span className="text-2xl font-mono font-bold text-white tracking-widest">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs text-slate-400 capitalize font-medium">
                                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                    </div>

                    {/* Navigation Tabs (Static Flex Wrap) */}
                    <div className="w-full flex flex-wrap gap-4">
                        {navTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm flex-grow sm:flex-grow-0 justify-center
                                ${activeTab === tab.id
                                        ? getActiveClasses(tab.color)
                                        : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {showTagModal && <TagRegistrationModal onSave={handleTagSave} />}

                    {/* Content Grid - REFACTORED to Flex for Full Width */}
                    <div className="flex flex-col gap-6 w-full h-full">

                        {activeTab === 'escala' && (
                            <div className="w-full h-full">
                                <MyScheduleView
                                    services={mySchedule}
                                    onBack={() => setActiveTab('overview')}
                                    onUpdateStatus={updateServico}
                                />
                            </div>
                        )}

                        {activeTab === 'navegacao' && (
                            <div className="w-full h-[80vh] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                                <NavigationApp
                                    driverLocation={(() => {
                                        const myCV = (currentUser as any)?.currentVehicle;
                                        const v = cartrackVehicles.find(cv => cv.registration === myCV);
                                        return v ? [v.latitude, v.longitude] : [38.7223, -9.1393];
                                    })()}
                                    destination={nextService?.destino}
                                    geofences={geofences}
                                    error={useWorkshop().cartrackError}
                                    vehicleRegistration={(currentUser as any)?.currentVehicle}
                                    onRetry={useWorkshop().refreshData}
                                    onLocationUpdate={useWorkshop().updateVehicleLocation}
                                    onBack={() => setActiveTab('overview')}
                                />
                            </div>
                        )}

                        <div className={`w-full space-y-6 ${activeTab === 'escala' || activeTab === 'navegacao' ? 'hidden' : ''}`}>

                            {activeTab === 'overview' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Hero Status Card */}
                                    <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                        <div className="relative z-10 space-y-8">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                <div>
                                                    <h2 className="text-3xl font-black text-white mb-2">Olá, {currentUser?.nome?.split(' ')[0] || (userRole === 'admin' ? 'Miguel' : 'Motorista')}</h2>
                                                    <p className="text-slate-400 text-lg">Pronto para o serviço de hoje?</p>
                                                </div>
                                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Online</span>
                                                </div>
                                            </div>

                                            {/* Static Grid for Widgets */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {/* Next Service Widget */}
                                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col group hover:border-blue-500/30 transition-all">
                                                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                                                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                                            <Navigation className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-wider">Próximo Serviço</span>
                                                    </div>
                                                    {nextService ? (
                                                        <div className="mt-2">
                                                            <p className="text-white font-black text-3xl mb-1">{nextService.hora}</p>
                                                            <p className="text-sm text-slate-400 flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                {nextService.origem} <ArrowRight className="w-3 h-3 text-slate-600" /> {nextService.destino}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center flex-1 py-4 text-center">
                                                            <p className="text-slate-500 text-sm font-medium">Sem serviços agendados</p>
                                                            <p className="text-xs text-slate-600 mt-1">Bom descanso!</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Vehicle Widget */}
                                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col group hover:border-indigo-500/30 transition-all">
                                                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                                                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                                            <Car className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-wider">Viatura</span>
                                                    </div>
                                                    {myVehicle ? (
                                                        <div className="mt-2 text-left">
                                                            <p className="text-white font-black text-2xl mb-1 truncate">{myVehicle.registration}</p>
                                                            <p className="text-sm text-slate-400 truncate">{myVehicle.make || ''} {myVehicle.model || myVehicle.label || 'Viatura da Frota'}</p>
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${myVehicle.status === 'moving' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${myVehicle.status === 'moving' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                                                    {myVehicle.status === 'moving' ? 'Em Movimento' : 'Parada'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center flex-1 py-4 text-center">
                                                            <p className="text-slate-500 text-sm font-medium">Nenhuma viatura detetada</p>
                                                            <p className="text-[10px] text-slate-600 mt-1">Passe a sua tag na viatura</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Weather Widget */}
                                                <div className={`relative overflow-hidden bg-gradient-to-br ${weather ? getWeatherBackground(weather.current.code) : 'from-[#0083B0] to-[#00B4DB]'} p-5 rounded-3xl border border-white/10 shadow-2xl h-full flex flex-col text-white transition-colors duration-1000 min-h-[160px]`}>
                                                    <div className="absolute inset-0 bg-white/10 pointer-events-none"></div>
                                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300/30 rounded-full blur-3xl"></div>

                                                    <div className="relative z-10 flex flex-col h-full">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="text-xs font-bold uppercase tracking-widest text-blue-100">Meteorologia</div>
                                                            <div className="text-xs font-medium text-blue-100">{new Date().toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' })}</div>
                                                        </div>

                                                        {weather ? (
                                                            <div className="flex-1 flex flex-col">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="text-left">
                                                                        <span className="text-5xl font-black tracking-tighter drop-shadow-lg">{weather.current.temp}°</span>
                                                                        <p className="text-sm font-medium text-blue-100 capitalize mt-1">{weather.current.desc}</p>
                                                                    </div>
                                                                    <div className="w-16 h-16 drop-shadow-2xl">
                                                                        {getWeatherIcon(weather.current.code, "w-16 h-16")}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 flex items-center justify-center">
                                                                <p className="text-xs text-white/70 animate-pulse">A atualizar...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Shift Widget */}
                                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col group hover:border-emerald-500/30 transition-all relative min-h-[160px]">
                                                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                                                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                                            <Clock className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-wider">Turno</span>
                                                    </div>

                                                    <button
                                                        onClick={() => setEditingShift(true)}
                                                        className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                        style={{ zIndex: 20 }}
                                                    >
                                                        <Settings2 className="w-3.5 h-3.5" />
                                                    </button>

                                                    {editingShift ? (
                                                        <div className="flex flex-col gap-3 mt-auto relative z-50 animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Início</span>
                                                                    <input
                                                                        type="time"
                                                                        value={tempShift.start}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={e => setTempShift({ ...tempShift, start: e.target.value })}
                                                                        className="bg-slate-950 text-white text-sm rounded-lg p-2 w-full outline-none border border-slate-700 focus:border-blue-500 transition-colors"
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Fim</span>
                                                                    <input
                                                                        type="time"
                                                                        value={tempShift.end}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={e => setTempShift({ ...tempShift, end: e.target.value })}
                                                                        className="bg-slate-950 text-white text-sm rounded-lg p-2 w-full outline-none border border-slate-700 focus:border-blue-500 transition-colors"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => setEditingShift(false)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors">Cancelar</button>
                                                                <button onClick={saveShift} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white transition-colors shadow-lg shadow-emerald-900/20">Gravar</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2">
                                                            <p className="text-white font-black text-2xl mb-1 flex items-center gap-2">
                                                                {tempShift.start} <span className="text-slate-600 text-lg mx-1">-</span> {tempShift.end}
                                                            </p>
                                                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Horário Regular</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Quick Stats Grid */}
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between h-24">
                                                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Serviços Hoje</span>
                                                    <span className="text-3xl font-black text-white">{myServicesCount}</span>
                                                </div>
                                                <div className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between h-24 relative overflow-hidden group">
                                                    <div className="absolute inset-0 bg-amber-500/5 pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
                                                    <div className="flex justify-between items-start relative z-10">
                                                        <span className="text-amber-200/70 text-xs font-bold uppercase tracking-wider">Avaliação Geral</span>
                                                        <div className="flex gap-0.5">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Star key={star} className={`w-3 h-3 ${star <= 5 ? 'text-amber-400 fill-amber-400' : 'text-amber-900'}`} />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-end justify-between relative z-10">
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="text-4xl font-black text-amber-400 tracking-tighter drop-shadow-lg">4.9</span>
                                                            <span className="text-xs text-amber-500/70 font-bold mb-1">/ 5.0</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                            Excelente
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between h-24">
                                                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Faltas</span>
                                                    <span className="text-3xl font-black text-emerald-500">0</span>
                                                </div>
                                                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center items-center h-24 cursor-pointer hover:border-slate-600 transition-colors group">
                                                    <span className="text-slate-500 group-hover:text-white transition-colors text-xs font-bold uppercase text-center">Ver Perfil Completo</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'abastecimentos' && (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                        <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                                            <Fuel className="w-6 h-6" />
                                        </div>
                                        Confirmação de Abastecimentos
                                    </h3>
                                    {notifications.filter((n: any) =>
                                        n.type === 'fuel_confirmation_request' &&
                                        n.status === 'pending' &&
                                        (n.response?.driverId === currentUser?.id || !n.response?.driverId)
                                    ).length === 0 ? (
                                        <div className="text-center py-16 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                                            <p className="text-slate-500 font-medium">Nenhum pedido pendente</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {notifications.filter((n: any) =>
                                                n.type === 'fuel_confirmation_request' &&
                                                n.status === 'pending' &&
                                                (n.response?.driverId === currentUser?.id || !n.response?.driverId)
                                            ).map((n: any) => (
                                                <div key={n.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-slate-600 transition-colors">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 border border-orange-500/20">
                                                            <Fuel className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h4 className="font-bold text-white text-lg">Abastecimento</h4>
                                                                <span className="bg-orange-500/10 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded-full border border-orange-500/20">Pendente</span>
                                                            </div>
                                                            <p className="text-slate-400 text-sm">
                                                                <span className="text-white font-bold">{n.data.liters}L</span> na viatura <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded ml-1">{n.data.licensePlate}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 w-full md:w-auto">
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm('Confirma que este abastecimento foi realizado?')) {
                                                                    const res = await confirmRefuel(n.response.serviceId);
                                                                    if (res && res.error) {
                                                                        alert('Erro: ' + JSON.stringify(res.error));
                                                                        return;
                                                                    }
                                                                    addNotification({
                                                                        id: crypto.randomUUID(),
                                                                        type: 'system_alert',
                                                                        data: {
                                                                            title: 'Abastecimento Confirmado',
                                                                            message: `${currentUser?.nome} confirmou o abastecimento.`,
                                                                            priority: 'normal'
                                                                        },
                                                                        status: 'pending',
                                                                        timestamp: new Date().toISOString()
                                                                    });
                                                                }
                                                            }}
                                                            className="flex-1 md:flex-none h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-colors"
                                                        >
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                /* Handle rejection if needed */
                                                                alert('Funcionalidade de rejeição em desenvolvimento');
                                                            }}
                                                            className="flex-1 md:flex-none h-10 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors"
                                                        >
                                                            Recusar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'viatura' && myVehicle && (
                                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col md:flex-row gap-8 items-start">
                                        {/* Image Section */}
                                        <div className="w-full md:w-1/3 aspect-[4/3] rounded-2xl bg-slate-800 overflow-hidden relative group">
                                            {/* Placeholder for Car Image - In real app, fetch from vehicle photos */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-600 group-hover:text-slate-500 transition-colors">
                                                <Car className="w-16 h-16 opacity-20" />
                                            </div>
                                            <div className="absolute top-4 left-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase border backdrop-blur-md shadow-lg ${myVehicle.status === 'moving' ? 'bg-emerald-500/80 text-white border-emerald-400/30' : 'bg-slate-800/80 text-white border-slate-600/30'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${myVehicle.status === 'moving' ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></span>
                                                    {myVehicle.status === 'moving' ? 'Em Movimento' : 'Parada'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Info Section */}
                                        <div className="flex-1 space-y-6">
                                            <div>
                                                <h3 className="text-3xl font-black text-white mb-2">{myVehicle.registration}</h3>
                                                <p className="text-xl text-slate-400">{myVehicle.make || ''} {myVehicle.model || myVehicle.label || 'Viatura Indefinida'}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                    <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Combustível</span>
                                                    <span className="text-lg font-bold text-white">{'N/A'}</span>
                                                </div>
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                    <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Odómetro</span>
                                                    <span className="text-lg font-bold text-white">{myVehicle.odometer != null ? `${Math.round(myVehicle.odometer / 1000)} km` : 'N/A'}</span>
                                                </div>
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                    <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Velocidade</span>
                                                    <span className="text-lg font-bold text-white">{myVehicle.speed != null ? `${Math.round(myVehicle.speed)} km/h` : '0 km/h'}</span>
                                                </div>
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                    <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Ignição</span>
                                                    <span className={`text-lg font-bold ${myVehicle.ignition ? 'text-emerald-500' : 'text-slate-400'}`}>{myVehicle.ignition ? 'LIGADA' : 'DESLIGADA'}</span>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-slate-800">
                                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                                    <Navigation className="w-4 h-4" />
                                                    {myVehicle.address || 'Localização desconhecida'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Requests & Reports Forms */}
                            {activeTab === 'pedidos' && (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xl font-bold text-white mb-6">Novo Pedido</h3>
                                    <form onSubmit={handleSubmitRequest} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Tipo de Pedido</label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {['ferias', 'folga', 'adiantamento', 'documentos'].map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setRequestForm({ ...requestForm, type })}
                                                        className={`h-12 rounded-xl font-bold text-sm capitalize transition-all border ${requestForm.type === type ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Descrição / Detalhes</label>
                                            <textarea
                                                value={requestForm.description}
                                                onChange={e => setRequestForm({ ...requestForm, description: e.target.value })}
                                                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                                                placeholder="Descreva o seu pedido..."
                                                required
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm uppercase tracking-wide shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2">
                                                <Send className="w-4 h-4" />
                                                Enviar Pedido
                                            </button>
                                        </div>
                                    </form>

                                    <div className="mt-12 pt-8 border-t border-slate-800">
                                        <h4 className="text-lg font-bold text-white mb-4">Meus Pedidos Recentes</h4>
                                        {/* List of past requests would go here */}
                                        <div className="text-center py-8 text-slate-500 text-sm">
                                            Histórico de pedidos em breve.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'reportar' && (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 text-red-500">
                                        <AlertTriangle className="w-6 h-6" />
                                        Reportar Ocorrência
                                    </h3>
                                    <form onSubmit={handleSubmitReport} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Tipo de Ocorrência</label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {['acidente', 'avaria', 'limpeza', 'outro'].map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setReportForm({ ...reportForm, type })}
                                                        className={`h-12 rounded-xl font-bold text-sm capitalize transition-all border ${reportForm.type === type ? 'bg-red-600 text-white border-red-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Descrição Detalhada</label>
                                            <textarea
                                                value={reportForm.description}
                                                onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                                                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                                                placeholder="Descreva o que aconteceu..."
                                                required
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm uppercase tracking-wide shadow-lg shadow-red-900/30 transition-all flex items-center gap-2">
                                                <Send className="w-4 h-4" />
                                                Enviar Reporte
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeTab === 'recibos' && (
                                <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 shadow-xl min-h-[400px] flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20">
                                        <FileText className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2">Recibos de Vencimento</h3>
                                    <p className="text-slate-400 max-w-md mx-auto">
                                        Esta funcionalidade estará disponível em breve. Poderá consultar e descarregar os seus recibos de vencimento diretamente aqui.
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
