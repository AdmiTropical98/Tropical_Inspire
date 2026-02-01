import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Check, User, Car, Wrench, UserCog, ClipboardCheck } from 'lucide-react';

interface UserProfileMenuProps {
    onNavigate?: () => void;
    showName?: boolean;
}

export default function UserProfileMenu({ onNavigate, showName = true }: UserProfileMenuProps) {
    const { userRole, currentUser, logout, updateStatus: updateContextStatus } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [userStatus, setUserStatus] = useState<'online' | 'absent' | 'busy' | 'offline'>('online');
    const [language, setLanguage] = useState<'pt' | 'en'>('pt');
    const menuRef = useRef<HTMLDivElement>(null);

    const getDisplayName = () => {
        return currentUser?.nome || (userRole === 'admin' ? 'Administrador' : 'Utilizador');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
            case 'absent': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
            case 'busy': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
            case 'offline': return 'bg-red-500';
            default: return 'bg-slate-500';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'online': return language === 'pt' ? 'Online' : 'Online';
            case 'absent': return language === 'pt' ? 'Ausente' : 'Away';
            case 'busy': return language === 'pt' ? 'Ocupado' : 'Busy';
            case 'offline': return language === 'pt' ? 'Offline' : 'Offline';
            default: return status;
        }
    };

    const getRoleIcon = () => {
        switch (userRole) {
            case 'motorista':
                return <Car className="w-6 h-6 text-white" />;
            case 'oficina':
                return <Wrench className="w-6 h-6 text-white" />;
            case 'supervisor':
                return <ClipboardCheck className="w-6 h-6 text-white" />;
            case 'admin':
                return <UserCog className="w-6 h-6 text-white" />;
            default:
                return <User className="w-6 h-6 text-white" />;
        }
    };

    const getRoleGradient = () => {
        switch (userRole) {
            case 'motorista': return 'from-blue-600 to-cyan-600 shadow-blue-500/20';
            case 'oficina': return 'from-orange-500 to-amber-500 shadow-orange-500/20';
            case 'supervisor': return 'from-purple-600 to-indigo-600 shadow-purple-500/20';
            case 'admin': return 'from-red-600 to-rose-600 shadow-red-500/20';
            default: return 'from-slate-600 to-slate-500';
        }
    };

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
    };

    const updateStatus = (status: 'online' | 'absent' | 'busy' | 'offline') => {
        if (status === 'offline') {
            // Mapping offline to busy or handling it specifically depending on backend requirement
            // For now, allow UI to show offline
            setUserStatus('busy'); // Fallback or Keep as is? Original code had 'offline' logic in render but 'busy' in state helper
            // Actually let's trust the render logic which had 'offline' button
            setUserStatus('offline' as any);
        } else {
            setUserStatus(status);
        }
        // Map 'busy' to 'online' for backend if needed, or cast if backend supports it but type doesn't
        const contextStatus = status === 'busy' ? 'online' : status;
        updateContextStatus(contextStatus as 'online' | 'absent' | 'offline');
        setIsOpen(false);
    };

    const handleProfileClick = () => {
        setIsOpen(false);
        if (onNavigate) onNavigate();
    };

    if (!userRole) return null;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/5 transition-all group"
            >
                {/* Status Indicator (Mobile/Compact) */}
                {showName && (
                    <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border bg-opacity-10 
                    ${userStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            userStatus === 'absent' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                'bg-red-500/10 border-red-500/20 text-red-500'}
                `}>
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(userStatus)} ${userStatus === 'online' ? 'animate-pulse' : ''}`}></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{getStatusLabel(userStatus)}</span>
                    </div>
                )}

                {/* Avatar / Role Icon */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getRoleGradient()} flex items-center justify-center text-white font-bold shadow-lg overflow-hidden border border-white/10`}>
                    {getRoleIcon()}
                </div>

                {showName && (
                    <div className="hidden md:block text-left">
                        <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                            {getDisplayName()}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            {userRole}
                        </p>
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-3 w-64 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">

                    {/* Header */}
                    <div className="p-4 bg-gradient-to-b from-slate-800/50 to-transparent border-b border-slate-700/50 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getRoleGradient()} flex items-center justify-center text-white font-bold shadow-lg border border-white/10`}>
                            {getRoleIcon()}
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">{getDisplayName()}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{userRole}</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="mb-2 p-2">
                        <button
                            onClick={handleProfileClick}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors mb-1"
                        >
                            <User className="w-4 h-4 text-blue-400" />
                            <span>Meu Perfil</span>
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50 mx-3"></div>

                    {/* Status Selection */}
                    <div className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500">Estado</p>
                        <button onClick={() => updateStatus('online')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span>Online</span>
                            </div>
                            {userStatus === 'online' && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>
                        <button onClick={() => updateStatus('absent')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                <span>Ausente</span>
                            </div>
                            {userStatus === 'absent' && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>
                        <button onClick={() => updateStatus('offline')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span>Offline</span>
                            </div>
                            {/* Assuming offline maps to busy or custom state for checkmark */}
                            {(userStatus === 'offline' || userStatus === 'busy') && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50 my-2 mx-3"></div>

                    {/* Language Selection */}
                    <div className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500">Idioma / Language</p>
                        <button onClick={() => setLanguage('pt')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🇵🇹</span>
                                <span>Português</span>
                            </div>
                            {language === 'pt' && <Check className="w-4 h-4 text-indigo-500" />}
                        </button>
                        <button onClick={() => setLanguage('en')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🇬🇧</span>
                                <span>English</span>
                            </div>
                            {language === 'en' && <Check className="w-4 h-4 text-indigo-500" />}
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50 my-2 mx-3"></div>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Terminar Sessão
                    </button>
                </div>
            )}
        </div>
    );
}
