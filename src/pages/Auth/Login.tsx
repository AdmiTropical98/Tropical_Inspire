import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { Lock, Mail, ChevronRight, AlertCircle, Eye, EyeOff, User, ShieldCheck, UserCog, Send, CheckCircle, X, Wrench, UserCheck } from 'lucide-react';
import type { Notification } from '../../types';

export default function Login() {
    const { login } = useAuth();
    const { addNotification, updateNotification, notifications, addSupervisor, addGestor } = useWorkshop();
    const [role, setRoleState] = useState<'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor'>(() => {
        const saved = localStorage.getItem('last_login_role');
        return (saved as any) || 'admin';
    });

    const setRole = (newRole: 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor') => {
        setRoleState(newRole);
        localStorage.setItem('last_login_role', newRole);
    };

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRegPassword, setShowRegPassword] = useState(false);

    // Role display names and icons
    const roleConfig = {
        admin: { label: 'Administrador', icon: <ShieldCheck className="w-5 h-5" />, color: 'blue' },
        gestor: { label: 'Gestor', icon: <UserCheck className="w-5 h-5" />, color: 'teal' },
        supervisor: { label: 'Supervisor', icon: <UserCog className="w-5 h-5" />, color: 'purple' },
        oficina: { label: 'Oficina', icon: <Wrench className="w-5 h-5" />, color: 'orange' },
        motorista: { label: 'Motorista', icon: <User className="w-5 h-5" />, color: 'emerald' },
    };

    // Registration Modal State
    const [showRegistration, setShowRegistration] = useState(false);
    const [regStep, setRegStep] = useState<'form' | 'verify'>('form');
    const [regData, setRegData] = useState({ nome: '', email: '', telemovel: '', password: '' });
    const [confirmPin, setConfirmPin] = useState('');
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = await login(role, email, password);
        if (!success) {
            setError(role === 'motorista' ? 'Dados de acesso incorretos.' : 'Email ou palavra-passe incorretos.');
        }
    };

    const handleRegistrationRequest = (e: React.FormEvent) => {
        e.preventDefault();
        setRegError('');

        // 1. Check for recent requests (Rate Limiting)
        const recentRequest = notifications.find(n =>
            n.type === 'registration_request' &&
            n.data.email === regData.email &&
            (new Date().getTime() - new Date(n.timestamp).getTime()) < 60000 // Less than 60 seconds ago
        );

        if (recentRequest) {
            const timeLeft = 60 - Math.floor((new Date().getTime() - new Date(recentRequest.timestamp).getTime()) / 1000);
            setRegError(`Por favor aguarde ${timeLeft} segundos antes de solicitar um novo PIN.`);
            return;
        }

        // 1.1 Strict Email Validation
        // Checking for 'algartempo' presence
        if (!regData.email.toLowerCase().includes('algartempo')) {
            setRegError('O email não é autenticado pela empresa. Contacte o administrador.');
            return;
        }

        // 2. Check if already has a pending request (older than 1 min) -> UPDATE it
        const existing = notifications.find(n =>
            n.type === 'registration_request' &&
            n.data.email === regData.email &&
            n.status === 'pending'
        );

        if (existing) {
            // Update the existing request with new timestamp and potential data changes
            updateNotification({
                ...existing,
                data: { ...regData, role },
                timestamp: new Date().toISOString()
            });

            setRegStep('verify');
            setRegSuccess('Pedido reenviado com sucesso! Aguarde o PIN do administrador.');
            return;
        }

        // 3. New Request
        const newNotification: Notification = {
            id: crypto.randomUUID(),
            type: 'registration_request',
            data: { ...regData, role }, // Include role for filtering
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        addNotification(newNotification);
        setRegStep('verify');
        setRegSuccess('Pedido enviado! Aguarde que o administrador lhe envie o PIN de confirmação.');
    };

    const handleConfirmation = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegError('');

        // Find the approved notification
        const notification = notifications.find(n =>
            n.type === 'registration_request' &&
            n.data.email === regData.email &&
            n.status === 'approved' &&
            n.response?.pin === confirmPin
        );

        if (notification) {
            try {
                if (role === 'supervisor') {
                    await addSupervisor({
                        id: crypto.randomUUID(),
                        nome: notification.data.nome || '',
                        email: notification.data.email || '',
                        telemovel: notification.data.telemovel || '',
                        password: notification.data.password || '',
                        pin: notification.response?.pin || '', // Use Activation PIN as Login PIN
                        status: 'active'
                    });
                } else if (role === 'gestor') {
                    await addGestor({
                        id: crypto.randomUUID(),
                        nome: notification.data.nome || '',
                        email: notification.data.email || '',
                        telemovel: notification.data.telemovel || '',
                        password: notification.data.password || '',
                        pin: notification.response?.pin || '', // Use Activation PIN as Login PIN
                        status: 'active',
                        blockedPermissions: [],
                        dataRegisto: new Date().toISOString()
                    });
                }

                // Success & Close
                setShowRegistration(false);
                setRegData({ nome: '', email: '', telemovel: '', password: '' });
                setConfirmPin('');
                setRegStep('form');
                setEmail(notification.data.email || '');
                setRole(notification.data.role as any || role); // Use role from notification
                setError('');
                alert('Conta criada com sucesso! Pode agora entrar.');
            } catch (err: any) {
                console.error("Error creating account:", err);
                setRegError('Erro ao criar conta no banco de dados. Tente novamente ou contacte o suporte.');
            }
        } else {
            setRegError('PIN inválido ou pedido ainda não aprovado pelo administrador.');
        }
    };




    return (
        <div className="h-[100dvh] w-full bg-[#0f172a] flex flex-col items-center px-4 pt-0 pb-4 relative transition-all duration-500 login-scrollbar overflow-y-auto">
            {/* Background Effects */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-xl relative z-10 flex flex-col items-center gap-0 -mt-24 mb-8">
                <img
                    src="/logo-algar-frota.png?v=4"
                    alt="Algar Frota"
                    className="w-96 h-auto object-contain drop-shadow-2xl relative z-20"
                />

                <div className="w-full bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8 -mt-32 relative z-10">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter">Gestão de Frota</h1>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-slate-500 text-sm font-medium">Entrar como:</span>
                            <span className={`text-${roleConfig[role].color}-400 text-sm font-bold bg-${roleConfig[role].color}-500/10 px-3 py-1 rounded-full border border-${roleConfig[role].color}-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                {roleConfig[role].label}
                            </span>
                        </div>
                    </div>

                    {/* Role Toggles */}
                    {/* Role Toggles */}
                    <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-900/50 rounded-2xl mb-8 border border-slate-700/50">
                        {Object.entries(roleConfig).map(([key, config]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => { setRole(key as any); setError(''); }}
                                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all duration-200
                                ${role === key ? `bg-${config.color}-600 text-white shadow-lg shadow-${config.color}-900/20 scale-105 z-10` : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}
                            `}
                            >
                                {config.icon}
                                {key === 'supervisor' ? 'Superv.' : key.charAt(0).toUpperCase() + key.slice(1)}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm animate-pulse">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                {(role === 'motorista' || role === 'oficina') ? 'Telemóvel' : 'Email'}
                            </label>
                            <div className="relative group">
                                {role === 'admin' ? (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                ) : role === 'supervisor' ? (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                ) : role === 'gestor' ? (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                                ) : role === 'oficina' ? (
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                                ) : (
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                )}
                                <input
                                    type={role === 'motorista' || role === 'oficina' ? 'tel' : 'email'}
                                    inputMode={role === 'motorista' || role === 'oficina' ? 'numeric' : 'email'}
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-4 text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                                    placeholder={
                                        role === 'admin' ? "Ex: admin@algartempo.com" :
                                            role === 'supervisor' ? "Ex: supervisor@algartempo.com" :
                                                role === 'gestor' ? "Ex: gestor@algartempo.com" :
                                                    "Introduza o seu telemóvel"
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    {(role === 'motorista' || role === 'oficina') ? 'PIN de Acesso' : 'Palavra-Passe'}
                                </label>

                            </div>
                            <div className="relative group">
                                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 transition-colors
                                    ${role === 'admin' ? 'group-focus-within:text-blue-400' :
                                        role === 'supervisor' ? 'group-focus-within:text-purple-400' :
                                            role === 'gestor' ? 'group-focus-within:text-teal-400' :
                                                role === 'oficina' ? 'group-focus-within:text-orange-400' :
                                                    'group-focus-within:text-emerald-400'}
                                `} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    inputMode={role === 'motorista' || role === 'oficina' ? 'numeric' : 'text'}
                                    required
                                    value={password}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if ((role === 'motorista' || role === 'oficina') && !/^\d*$/.test(val)) return;
                                        setPassword(val);
                                    }}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-12 text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                                    placeholder={role === 'admin' || role === 'supervisor' || role === 'gestor' ? "Introduza a sua password" : "Introduza o seu PIN (4-6 dígitos)"}
                                    maxLength={(role === 'motorista' || role === 'oficina') ? 6 : undefined}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="md:relative fixed bottom-0 left-0 w-full p-4 md:p-0 bg-slate-950/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-t border-slate-800 md:border-none z-30">
                            <button
                                type="submit"
                                className={`w-full text-white font-black uppercase tracking-widest py-4 md:py-5 rounded-2xl shadow-xl transform active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 group
                                ${role === 'admin'
                                        ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 shadow-blue-900/30'
                                        : role === 'supervisor'
                                            ? 'bg-gradient-to-br from-purple-600 via-purple-700 to-fuchsia-800 shadow-purple-900/30'
                                            : role === 'gestor'
                                                ? 'bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 shadow-teal-900/30'
                                                : role === 'oficina'
                                                    ? 'bg-gradient-to-br from-orange-600 via-orange-700 to-amber-800 shadow-orange-900/30'
                                                    : 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 shadow-emerald-900/30'
                                    }
                            `}
                            >
                                {roleConfig[role].icon}
                                Entrar como {roleConfig[role].label}
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                            </button>
                        </div>

                        {(role === 'supervisor' || role === 'gestor') && (
                            <button
                                type="button"
                                onClick={() => setShowRegistration(true)}
                                className="w-full text-slate-400 hover:text-white font-medium py-3 rounded-xl hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <UserCog className="w-4 h-4" />
                                Criar Conta {role === 'supervisor' ? 'Supervisor' : 'Gestor'} (AlgarTempo)
                            </button>
                        )}
                    </form>



                    <div className="mt-8 text-center space-y-2">
                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em]">
                            &copy; 2025 Algartempo Frota
                        </p>
                        <div className="flex items-center justify-center gap-2 opacity-30 group">
                            <span className="text-[10px] text-slate-500 font-mono">v1.11.0</span>
                            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                            <span className="text-[10px] text-slate-500 font-mono">PRODUÇÃO</span>
                        </div>
                    </div>


                </div>
            </div>



            {/* Registration Modal Overlay */}
            {showRegistration && (
                <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <UserCog className={`w-5 h-5 ${role === 'supervisor' ? 'text-purple-500' : 'text-teal-500'}`} />
                                    {role === 'supervisor' ? 'Registo de Supervisor' : 'Registo de Gestor'}
                                </h2>
                                <p className="text-sm text-slate-400">
                                    {regStep === 'form' ? 'Preencha os seus dados' : 'Validação de Segurança'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRegistration(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto">
                            {regStep === 'form' ? (
                                <form onSubmit={handleRegistrationRequest} className="space-y-4">
                                    {regSuccess && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-400 text-sm flex items-center gap-2">
                                            <CheckCircle className="w-5 h-5" />
                                            {regSuccess}
                                        </div>
                                    )}

                                    {regError && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2 animate-pulse">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                            {regError}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Nome Completo</label>
                                        <input
                                            type="text"
                                            required
                                            value={regData.nome}
                                            onChange={e => setRegData({ ...regData, nome: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                            placeholder="Ex: João Silva"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-400 uppercase">Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={regData.email}
                                                onChange={e => setRegData({ ...regData, email: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                                placeholder="email@algartempo.com"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-400 uppercase">Telemóvel</label>
                                            <input
                                                type="tel"
                                                required
                                                value={regData.telemovel}
                                                onChange={e => setRegData({ ...regData, telemovel: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                                placeholder="912 345 678"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Definir Palavra-Passe</label>
                                        <div className="relative">
                                            <input
                                                type={showRegPassword ? "text" : "password"}
                                                required
                                                value={regData.password}
                                                onChange={e => setRegData({ ...regData, password: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none pr-10"
                                                placeholder="••••••••"
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowRegPassword(!showRegPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                            >
                                                {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800 mt-4">
                                        <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 mb-6">
                                            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-300">
                                                Para concluir o registo, será enviado um pedido ao Administrador.
                                                Deverá aguardar que lhe seja fornecido um <strong>PIN de Confirmação</strong>.
                                            </p>
                                        </div>

                                        <button
                                            type="submit"
                                            className={`w-full text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2
                                                ${role === 'supervisor' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-teal-600 hover:bg-teal-500'}
                                            `}
                                        >
                                            <Send className="w-4 h-4" />
                                            Validar Dados e Pedir PIN
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setRegStep('verify')}
                                            className="w-full mt-3 text-slate-400 hover:text-white text-sm py-2"
                                        >
                                            Já tenho um PIN
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleConfirmation} className="space-y-6">
                                    <div className="text-center space-y-2">
                                        <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto border border-purple-500/20 mb-4">
                                            <Lock className="w-8 h-8 text-purple-500" />
                                        </div>
                                        <h3 className="text-lg font-medium text-white">Confirmação de Identidade</h3>
                                        <p className="text-sm text-slate-400">
                                            Introduza o PIN fornecido pelo Administrador.
                                        </p>
                                    </div>

                                    {regError && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm text-center">
                                            {regError}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {/* Always ask for email to be safe against refresh/state loss */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-400 uppercase">Email de Registo</label>
                                            <input
                                                type="email"
                                                required
                                                value={regData.email}
                                                onChange={e => setRegData({ ...regData, email: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                                placeholder="email@algartempo.com"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-400 uppercase text-center block">PIN de Confirmação</label>
                                            <input
                                                type="text"
                                                required
                                                value={confirmPin}
                                                onChange={e => setConfirmPin(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-2xl font-mono tracking-widest text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder="0000"
                                                maxLength={6}
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 space-y-3">
                                        <button
                                            type="submit"
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Confirmar Registo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRegStep('form')}
                                            className="w-full text-slate-400 hover:text-white text-sm py-2"
                                        >
                                            Voltar / Corrigir Dados
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
