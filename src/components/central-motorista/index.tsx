import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
    LayoutTemplate, Clock, FileText, Share2, AlertTriangle,
    Send, Car, Sun, Navigation, Calendar,
    Check, Fuel, Settings2, ArrowRight,
    CloudSun, CloudFog, CloudLightning, CloudRain, Snowflake, Moon, Star, X
} from 'lucide-react';
import MyScheduleView from './MyScheduleView';
import DraggableGrid from '../common/DraggableGrid';
import { useLayout } from '../../contexts/LayoutContext';
import NavigationApp from './NavigationApp';
import TagRegistrationModal from '../common/TagRegistrationModal';
import { supabase } from '../../lib/supabase';

import { usePermissions } from '../../contexts/PermissionsContext';
import { cleanTagId } from '../../services/cartrack';

export default function CentralMotorista() {
    const { t } = useTranslation();
    const { currentUser, userRole, userPhoto, refreshCurrentUser } = useAuth();
    const { hasAccess } = usePermissions();
    const {
        servicos,
        notifications,
        addNotification,
        updateNotification,
        confirmRefuel,
        updateMotorista,
        complianceStats,
        cartrackVehicles,
        geofences,
        updateServico,
        refreshData
    } = useWorkshop();

    // Auto-refresh data every 30 seconds to keep vehicle position live
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

    // Layout Context
    const { isEditMode, toggleEditMode, saveChanges, cancelEditMode, resetLayout } = useLayout();

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

    // Fetch Weather including Forecast
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

    const myRequests = notifications
        .filter((n: any) => n.type === 'system_alert' && n.data.message?.includes(currentUser?.nome || ''))
        .map((n: any) => ({
            id: n.id,
            type: n.data.title?.replace('Novo Pedido: ', '') || 'Outros',
            date: new Date(n.timestamp).toLocaleDateString(),
            status: n.status,
            desc: n.data.message
        }));

    // Vehicle Detection Logic
    const myVehicle = (() => {
        if (!currentUser) return null;
        const driver = currentUser as any;

        // 1. Try to find by Cartrack Key (Tag)
        const userKey = driver.cartrackKey || driver.cartrack_key;
        if (userKey) {
            const cleanKey = cleanTagId(userKey);
            // Check if any vehicle has this tag currently active
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
    // @ts-ignore
    const myRating = currentUser?.rating || 0;

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
        if (code <= 67) return <CloudRain className={`${className} text-blue-300`} />; // Rain
        if (code <= 77) return <Snowflake className={`${className} text-white`} />; // Snow
        if (code <= 82) return <CloudRain className={`${className} text-blue-400`} />; // Showers
        if (code <= 99) return <CloudLightning className={`${className} text-purple-300`} />; // Thunder
        return <Sun className={className} />;
    };

    const getWeatherBackground = (code: number) => {
        if (code === 0) return 'from-[#0083B0] to-[#00B4DB]'; // Clear Sky (Blue/Cyan)
        if (code <= 3) return 'from-slate-500 to-slate-600'; // Cloudy (Grey)
        if (code <= 48) return 'from-slate-600 to-slate-700'; // Fog (Darker Grey)
        if (code <= 67) return 'from-slate-700 to-slate-800'; // Rain (Dark Slate)
        if (code <= 77) return 'from-blue-800 to-slate-800'; // Snow (Cold Dark)
        if (code <= 99) return 'from-indigo-900 to-slate-900'; // Thunder (Deep Dark Purple/Blue)
        return 'from-[#0083B0] to-[#00B4DB]';
    };

    const dashboardWidgets = [
        {
            id: 'next-service',
            defaultWidth: 'half',
            content: (
                <div className={`bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col group hover:border-blue-500/30 transition-all`}>
                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <Navigation className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Próximo Serviço</span>
                    </div>
                    {nextService ? (
                        <>
                            <div className="mt-2">
                                <p className="text-white font-black text-3xl mb-1">{nextService.hora}</p>
                                <p className="text-sm text-slate-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    {nextService.origem} <ArrowRight className="w-3 h-3 text-slate-600" /> {nextService.destino}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 py-4 text-center">
                            <p className="text-slate-500 text-sm font-medium">Sem serviços agendados</p>
                            <p className="text-xs text-slate-600 mt-1">Bom descanso!</p>
                        </div>
                    )}
                </div>
            )
        },
        {
            id: 'vehicle',
            defaultWidth: 'half',
            content: (
                <div className={`bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col group hover:border-indigo-500/30 transition-all`}>
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
            )
        },
        {
            id: 'weather',
            defaultWidth: 'half',
            content: (
                <div className={`relative overflow-hidden bg-gradient-to-br ${weather ? getWeatherBackground(weather.current.code) : 'from-[#0083B0] to-[#00B4DB]'} p-5 rounded-3xl border border-white/10 shadow-2xl h-full flex flex-col text-white transition-colors duration-1000`}>
                    {/* Glossy Overlay */}
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
                                        {/* Simple Large Icon Placeholder - In real iOS widget this is a 3D asset */}
                                        {getWeatherIcon(weather.current.code, "w-16 h-16")}
                                    </div>
                                </div>

                                {/* 3 Days Forecast */}
                                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/20 pt-3">
                                    {weather.daily.map((day, i) => (
                                        <div key={i} className="flex flex-col items-center text-center">
                                            <span className="text-[10px] font-bold uppercase text-blue-100 mb-1">{day.day}</span>
                                            <div className="mb-1 opacity-90 scale-75">
                                                {getWeatherIcon(day.code, "w-6 h-6")}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs font-bold">
                                                <span className="text-blue-100 opacity-70">{day.min}°</span>
                                                <span>{day.max}°</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-xs text-white/70 animate-pulse">A atualizar...</p>
                            </div>
                        )}
                    </div>
                </div>
            )
        },

        {
            id: 'shift',
            defaultWidth: 'half',
            content: (
                <div className={`bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-xl h-full flex flex-col group hover:border-emerald-500/30 transition-all relative`}>
                    <div className="flex items-center gap-3 text-slate-400 mb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Turno</span>
                    </div>

                    {!isEditMode && (
                        <button
                            onClick={() => setEditingShift(true)}
                            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            style={{ zIndex: 20 }}
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                        </button>
                    )}

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
            )
        }
    ];

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
        // Permission Check
        if (tab.id === 'navegacao') return hasAccess(userRole, 'central_navegacao');
        if (tab.id === 'recibos') return hasAccess(userRole, 'central_recibos');
        return true;
    }).map(tab => {
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

        return {
            id: tab.id,
            content: (
                <button
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                ${activeTab === tab.id
                            ? getActiveClasses(tab.color)
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            )
        };
    });

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
            {/* Full Width Container */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-4">
                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                                    {t('central.title')}
                                </span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium">{t('central.subtitle')}</p>
                        </div>
                        {/* Live Date/Time Widget */}
                        <div className="hidden md:flex flex-col items-end bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-700/50 shadow-sm">
                            <span className="text-2xl font-mono font-bold text-white tracking-widest">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs text-slate-400 capitalize font-medium">
                                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                    </div>

                    {/* Navigation Tabs (As RGL Grid now) */}
                    <div className="w-full">
                        <DraggableGrid
                            zoneId="central_tabs_rgl"
                            className="bg-transparent"
                            defaultLayouts={{
                                lg: navTabs.map((t, i) => ({ i: t.id, x: i * 2, y: 0, w: 2, h: 2 })),
                                md: navTabs.map((t, i) => ({ i: t.id, x: (i % 5) * 2, y: Math.floor(i / 5) * 2, w: 2, h: 2 })),
                                sm: navTabs.map((t, i) => ({ i: t.id, x: (i % 3) * 2, y: Math.floor(i / 3) * 2, w: 2, h: 2 }))
                            }}
                        >
                            {navTabs.map(tab => (
                                <div key={tab.id} className="flex items-center justify-center">
                                    {tab.content}
                                </div>
                            ))}
                        </DraggableGrid>
                    </div>

                    {/* Tag Registration Modal */}
                    {showTagModal && <TagRegistrationModal onSave={handleTagSave} />}

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 h-full">

                        {/* FULL WIDTH TABS */}
                        {activeTab === 'escala' && (
                            <div className="lg:col-span-3 h-full">
                                <MyScheduleView
                                    services={mySchedule}
                                    onBack={() => setActiveTab('overview')}
                                    onUpdateStatus={updateServico}
                                />
                            </div>
                        )}

                        {activeTab === 'navegacao' && (
                            <div className="lg:col-span-3 h-[80vh] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
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


                        {/* MAIN DASHBOARD AREA */}
                        <div className={`lg:col-span-2 space-y-6 ${activeTab === 'escala' || activeTab === 'navegacao' ? 'hidden' : ''} w-full`}>

                            {activeTab === 'overview' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Hero Status Card */}
                                    <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                        <div className="relative z-10">
                                            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                                                <div>
                                                    <h2 className="text-3xl font-black text-white mb-2">Olá, {currentUser?.nome?.split(' ')[0] || (userRole === 'admin' ? 'Miguel' : 'Motorista')}</h2>
                                                    <p className="text-slate-400 text-lg">Pronto para o serviço de hoje?</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-3">
                                                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Online</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {isEditMode ? (
                                                            <>
                                                                <button
                                                                    onClick={saveChanges}
                                                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-green-600 text-white shadow-lg shadow-green-900/20 animate-pulse flex items-center gap-2 hover:bg-green-500 transition-colors"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                    Gravar
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm('Restaurar layout padrão?')) {
                                                                            await resetLayout();
                                                                        }
                                                                    }}
                                                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 transition-colors flex items-center gap-2"
                                                                >
                                                                    <LayoutTemplate className="w-3.5 h-3.5" />
                                                                    Reset
                                                                </button>
                                                                <button
                                                                    onClick={cancelEditMode}
                                                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 flex items-center gap-2 hover:bg-red-500/20 transition-colors"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                    Cancelar
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={toggleEditMode}
                                                                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2"
                                                            >
                                                                <Settings2 className="w-3.5 h-3.5" />
                                                                Personalizar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* DASHBOARD WIDGETS GRID */}
                                            <DraggableGrid
                                                zoneId="central_driver_overview_rgl"
                                                defaultLayouts={{
                                                    lg: [
                                                        { i: 'next-service', x: 0, y: 0, w: 6, h: 4 },
                                                        { i: 'vehicle', x: 6, y: 0, w: 6, h: 4 },
                                                        { i: 'weather', x: 0, y: 4, w: 6, h: 6 },
                                                        { i: 'shift', x: 6, y: 4, w: 6, h: 6 }
                                                    ],
                                                    md: [
                                                        { i: 'next-service', x: 0, y: 0, w: 10, h: 4 },
                                                        { i: 'vehicle', x: 0, y: 4, w: 10, h: 4 },
                                                        { i: 'weather', x: 0, y: 8, w: 5, h: 6 },
                                                        { i: 'shift', x: 5, y: 8, w: 5, h: 6 }
                                                    ],
                                                    sm: [
                                                        { i: 'next-service', x: 0, y: 0, w: 6, h: 4 },
                                                        { i: 'vehicle', x: 0, y: 4, w: 6, h: 4 },
                                                        { i: 'weather', x: 0, y: 8, w: 6, h: 6 },
                                                        { i: 'shift', x: 0, y: 14, w: 6, h: 6 }
                                                    ]
                                                }}
                                            >
                                                {dashboardWidgets.map(widget => (
                                                    <div key={widget.id}>
                                                        {widget.content}
                                                    </div>
                                                ))}
                                            </DraggableGrid>
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
                            )}

                            {/* Render other Tabs with updated styling */}
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
                                                                    await updateNotification({ ...n, status: 'approved' });
                                                                }
                                                            }}
                                                            className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                                        >
                                                            <Check className="w-5 h-5" />
                                                            Aceitar
                                                        </button>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm('Rejeitar este pedido?')) await updateNotification({ ...n, status: 'rejected' })
                                                            }}
                                                            className="flex-1 md:flex-none px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                                                        >
                                                            <AlertTriangle className="w-5 h-5" />
                                                            Reportar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Pedidos Tab */}
                            {activeTab === 'pedidos' && (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                                            <Share2 className="w-6 h-6" />
                                        </div>
                                        Fazer um Pedido
                                    </h3>
                                    <form onSubmit={handleSubmitRequest} className="space-y-6 max-w-2xl">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Pedido</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                value={requestForm.type}
                                                onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}
                                            >
                                                <option value="ferias">Férias</option>
                                                <option value="material">Material / Fardamento</option>
                                                <option value="declaracao">Declaração</option>
                                                <option value="outros">Outros</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Descrição</label>
                                            <textarea
                                                required
                                                rows={4}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                                                value={requestForm.description}
                                                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                                                placeholder="Descreva o seu pedido detalhadamente..."
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20 flex items-center gap-2 transform hover:scale-105 active:scale-95">
                                                <Send className="w-5 h-5" />
                                                Enviar Pedido
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Reportar Tab */}
                            {activeTab === 'reportar' && (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                        <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                                            <AlertTriangle className="w-6 h-6" />
                                        </div>
                                        Reportar Incidente
                                    </h3>
                                    <form onSubmit={handleSubmitReport} className="space-y-6 max-w-2xl">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Incidente</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
                                            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Descrição</label>
                                            <textarea
                                                required
                                                rows={4}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                                                value={reportForm.description}
                                                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                                                placeholder="Descreva o incidente..."
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 flex items-center gap-2 transform hover:scale-105 active:scale-95">
                                                <AlertTriangle className="w-5 h-5" />
                                                Reportar Agora
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Minha Viatura Tab - Full Detail */}
                            {activeTab === 'viatura' && (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                                            <Car className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Minha Viatura Atual</h3>
                                            <p className="text-slate-400 text-sm">Informação em tempo real via Cartrack</p>
                                        </div>
                                    </div>

                                    {myVehicle ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Main Info */}
                                            <div className="space-y-6">
                                                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-3">
                                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${myVehicle.status === 'moving' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                            <span className={`w-2 h-2 rounded-full ${myVehicle.status === 'moving' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                                            {myVehicle.status === 'moving' ? 'Em Movimento' : 'Parada'}
                                                        </span>
                                                    </div>

                                                    <div className="mt-4">
                                                        <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Matrícula</p>
                                                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">{myVehicle.registration}</h2>
                                                    </div>

                                                    <div className="mt-6">
                                                        <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Veículo</p>
                                                        <p className="text-xl text-indigo-200 font-medium">{myVehicle.make || ''} {myVehicle.model || myVehicle.label}</p>
                                                    </div>

                                                    <div className="mt-8 grid grid-cols-2 gap-4">
                                                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Ignição</p>
                                                            <p className={`text-xl font-bold ${myVehicle.ignition ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                                {myVehicle.ignition ? 'LIGADA' : 'DESLIGADA'}
                                                            </p>
                                                        </div>
                                                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 hidden">
                                                            {/* Speed removed as requested */}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Location & Map */}
                                            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                                                <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Última Localização</p>
                                                    <p className="text-sm text-white line-clamp-2">{myVehicle.address || 'Localização desconhecida'}</p>
                                                    <p className="text-[10px] text-slate-600 mt-1 font-mono">
                                                        Atualizado: {myVehicle.last_position_update ? new Date(myVehicle.last_position_update).toLocaleTimeString() : 'N/A'}
                                                    </p>
                                                </div>

                                                {/* Mini Map Static Placeholder or Simple Visual */}
                                                <div className="flex-1 bg-[#1e293b] relative flex items-center justify-center min-h-[200px]">
                                                    {/* Simple Radar Animation */}
                                                    <div className="absolute inset-0 opacity-20">
                                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-indigo-500 rounded-full animate-ping"></div>
                                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-indigo-500 rounded-full animate-ping delay-150"></div>
                                                    </div>
                                                    <Car className="w-12 h-12 text-indigo-500 relative z-10" />
                                                </div>

                                                <div className="p-4">
                                                    <button
                                                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${myVehicle.latitude},${myVehicle.longitude}`, '_blank')}
                                                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Navigation className="w-4 h-4" />
                                                        Localização Atual
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                                            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                                                <Car className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-2">Nenhuma viatura detetada</h4>
                                            <p className="text-slate-500 max-w-sm mx-auto mb-6">
                                                Para ver os dados da sua viatura, certifique-se que passou a sua tag Cartrack no leitor do veículo.
                                            </p>
                                            {(currentUser as any)?.cartrackKey && (
                                                <div className="inline-block bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold">A sua Tag</p>
                                                    <p className="font-mono text-indigo-400 font-bold">{(currentUser as any).cartrackKey}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Recibos - Fallback */}
                            {activeTab === 'recibos' && (
                                <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 text-center animate-in fade-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <FileText className="w-10 h-10 text-slate-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2 capitalize">{activeTab}</h3>
                                    <p className="text-slate-400 max-w-md mx-auto">Esta funcionalidade está em desenvolvimento e estará disponível brevemente.</p>
                                </div>
                            )}

                        </div>


                        {/* SIDEBAR (PROFILE & NOTIFICATIONS) - RIGHT COLUMN */}
                        <div className={`lg:col-span-1 space-y-6 h-full ${activeTab === 'escala' || activeTab === 'navegacao' ? 'hidden' : ''}`}>

                            {/* User Profile Card */}
                            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col items-center shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-blue-900/20 to-transparent"></div>
                                <div className="relative mb-6">
                                    <div className="w-32 h-32 rounded-full bg-slate-950 border-4 border-slate-800 overflow-hidden shadow-2xl">
                                        {userPhoto ? (
                                            <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.nome || 'User')}&background=0D8ABC&color=fff`} alt="Profile" className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="absolute bottom-1 right-1 bg-emerald-500 w-8 h-8 rounded-full border-4 border-slate-900 flex items-center justify-center shadow-lg">
                                        <Check className="w-4 h-4 text-slate-900 stroke-[3]" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-white mb-1 text-center">{currentUser?.nome}</h3>
                                <p className="text-slate-400 font-medium mb-6 bg-slate-800 px-4 py-1 rounded-full text-sm">Motorista Profissional</p>

                                <div className="w-full space-y-3">
                                    <div className="bg-slate-800/50 p-4 rounded-xl flex items-center justify-between border border-slate-700/50">
                                        <span className="text-slate-500 text-xs font-bold uppercase">Cartas</span>
                                        <span className="font-mono text-white font-bold bg-slate-700 px-2 py-0.5 rounded">B, C</span>
                                    </div>
                                    {(currentUser as any)?.cartrackKey && (
                                        <div className="bg-slate-800/50 p-4 rounded-xl border border-blue-500/10">
                                            <span className="block text-blue-500 text-[10px] font-bold uppercase mb-1">Chave Identificação</span>
                                            <span className="font-mono text-white text-sm break-all">{(currentUser as any).cartrackKey}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notifications / Requests Status */}
                            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 h-fit max-h-[500px] overflow-y-auto custom-scrollbar">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Share2 className="w-4 h-4" /> Meus Pedidos Recentes
                                </h3>
                                <div className="space-y-4">
                                    {myRequests.length > 0 ? myRequests.map((req: any) => (
                                        <div key={req.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors cursor-default">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-bold text-white capitalize">{req.type}</p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                    {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{req.desc}</p>
                                            <div className="text-[10px] text-slate-600 font-medium text-right">{req.date}</div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-600">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <p className="text-slate-500 text-sm">Sem pedidos recentes.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Documents Widget */}
                            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Validade Documentos
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <Check className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">Carta Condução</p>
                                            <p className="text-xs text-emerald-500">Válida</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <Check className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">CAM</p>
                                            <p className="text-xs text-emerald-500">Válido</p>
                                        </div>
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
