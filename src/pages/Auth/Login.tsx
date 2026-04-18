import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { Lock, Mail, ChevronRight, AlertCircle, Eye, EyeOff, User, Users, ShieldCheck, UserCog, Send, CheckCircle, X, Wrench, UserCheck, MapPin } from 'lucide-react';
import type { Notification } from '../../types';

export default function Login() {
    const isCapacitorAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

    // Lock scroll synchronously before paint
    document.documentElement.classList.add('login-active');

    useEffect(() => {
        const root = document.getElementById('root');

        if (isCapacitorAndroid) {
            document.documentElement.classList.add('android-native-root');
            document.body.classList.add('android-native-root');
            root?.classList.add('android-native-root');
            document.documentElement.style.width = '100vw';
            document.documentElement.style.maxWidth = '100vw';
            document.body.style.width = '100vw';
            document.body.style.maxWidth = '100vw';
            root?.style.setProperty('width', '100vw');
            root?.style.setProperty('max-width', '100vw');
            root?.style.setProperty('margin', '0');
            root?.style.setProperty('padding', '0');
        }

        return () => {
            document.documentElement.classList.remove('login-active');
            if (isCapacitorAndroid) {
                document.documentElement.classList.remove('android-native-root');
                document.body.classList.remove('android-native-root');
                root?.classList.remove('android-native-root');
                document.documentElement.style.removeProperty('width');
                document.documentElement.style.removeProperty('max-width');
                document.body.style.removeProperty('width');
                document.body.style.removeProperty('max-width');
                root?.style.removeProperty('width');
                root?.style.removeProperty('max-width');
                root?.style.removeProperty('margin');
                root?.style.removeProperty('padding');
            }
        };
    }, [isCapacitorAndroid]);

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
        supervisor: { label: 'Supervisor', icon: <UserCog className="w-5 h-5" />, color: 'blue' },
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
        // Accept both previous and new company domains during the transition.
        const normalizedEmail = regData.email.toLowerCase();
        if (!normalizedEmail.includes('algartempo') && !normalizedEmail.includes('atlusnoc')) {
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
                        status: 'active',
                        role: 'SUPERVISOR'
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
        <div className="login-scrollbar relative min-h-[100dvh] overflow-x-hidden overflow-y-auto" style={{ backgroundImage: "url('/fundo_páginas.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            <div className="absolute inset-0 z-0" style={{ background: 'rgba(255, 255, 255, 0.55)' }} />
            <div className="absolute left-[-8%] top-[18%] h-px w-[52%] rotate-[-16deg] bg-gradient-to-r from-transparent via-blue-200/80 to-transparent opacity-70" />
            <div className="absolute left-[2%] top-[38%] h-px w-[46%] rotate-[8deg] bg-gradient-to-r from-transparent via-blue-100/90 to-transparent opacity-80" />
            <div className="absolute right-[4%] top-[28%] h-px w-[24%] rotate-[28deg] bg-gradient-to-r from-transparent via-slate-200/80 to-transparent opacity-60 hidden lg:block" />
            <div className="absolute inset-x-[-10%] bottom-[-2%] h-[28vh] opacity-90" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(219,234,254,0.18) 35%, rgba(191,219,254,0.32) 100%)', clipPath: 'ellipse(72% 58% at 50% 100%)' }} />
            <div className="absolute inset-x-[-6%] bottom-[-7%] h-[24vh] opacity-90" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 100%)', clipPath: 'ellipse(68% 54% at 50% 100%)' }} />

            <div className="absolute left-[7%] top-[24%] hidden h-24 w-24 rounded-full border border-blue-100/80 bg-white/20 lg:block">
                <MapPin className="absolute inset-0 m-auto h-8 w-8 text-blue-100" />
            </div>
            <div className="absolute right-[7%] top-[14%] hidden h-16 w-16 rounded-full border border-slate-200/70 bg-white/20 lg:block">
                <MapPin className="absolute inset-0 m-auto h-5 w-5 text-slate-200" />
            </div>
            <div className="absolute right-[9%] top-[42%] hidden h-20 w-20 rounded-full border border-blue-100/70 bg-white/10 lg:block">
                <MapPin className="absolute inset-0 m-auto h-7 w-7 text-blue-100" />
            </div>

            <div className={`android-page-shell relative z-10 flex min-h-[100dvh] w-full items-start ${isCapacitorAndroid ? 'android-native-shell mx-0 max-w-[100vw] justify-start px-0 py-0 lg:items-start lg:px-0 xl:px-0' : 'mx-auto max-w-[1440px] justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-16 xl:px-20'}`}>
                <div className="grid w-full grid-cols-1 items-center gap-6 lg:grid-cols-[1.05fr_0.72fr] xl:gap-16">
                    <section className="relative hidden items-center justify-center lg:flex lg:justify-start">
                        <div className="relative flex w-full items-center justify-center lg:justify-center">
                            <img src="/LOGO.png" alt="Algartempo Frota" className="w-full max-w-[360px] object-contain drop-shadow-[0_20px_40px_rgba(37,99,235,0.08)] sm:max-w-[430px] lg:max-w-[520px]" />
                        </div>
                    </section>

                    <section className="flex items-center justify-center lg:justify-end">
                        <div className="android-page-card auth-card w-full max-w-[424px] rounded-[1.9rem] border border-white/85 bg-white/94 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-9">
                            <div className="mb-4 flex items-center gap-3 sm:hidden">
                                <div className="rounded-2xl bg-slate-50 px-3 py-2 shadow-sm border border-slate-200">
                                    <img src="/LOGO.png" alt="Algartempo Frota" className="h-8 w-auto" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Acesso Seguro</p>
                                    <p className="text-sm font-semibold text-slate-700">Plataforma interna</p>
                                </div>
                            </div>
                            <div className="mb-5 flex items-center justify-start">
                                <div className="relative w-full max-w-[190px]">
                                    <select
                                        value={role}
                                        onChange={(e) => {
                                            setRole(e.target.value as any);
                                            setError('');
                                        }}
                                        className="h-10 w-full appearance-none rounded-full border border-slate-200 bg-white px-4 pr-10 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 outline-none transition-colors focus:border-blue-500"
                                    >
                                        {Object.entries(roleConfig).map(([key, config]) => (
                                            <option key={key} value={key}>{config.label}</option>
                                        ))}
                                    </select>
                                    <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
                                </div>
                            </div>

                            <div className="mb-6">
                                <h1 className="text-[2.1rem] font-extrabold tracking-[-0.04em] text-[#1f2957] sm:text-[2.35rem]">Bem-vindo de volta!</h1>
                                <p className="mt-2 text-[1.02rem] text-slate-500">Inicie sessão para continuar.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="sr-only">
                                        {(role === 'motorista' || role === 'oficina') ? 'Telemóvel' : 'Endereço de E-mail'}
                                    </label>
                                    <div className="relative">
                                        {(role === 'admin' || role === 'supervisor' || role === 'gestor') ? (
                                            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                                        ) : (
                                            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                                        )}
                                        <input
                                            type={role === 'motorista' || role === 'oficina' ? 'tel' : 'email'}
                                            inputMode={role === 'motorista' || role === 'oficina' ? 'numeric' : 'email'}
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 focus:border-[#d8ab42] focus:ring-4 focus:ring-amber-100"
                                            placeholder={(role === 'motorista' || role === 'oficina') ? 'Telemóvel' : 'Endereço de E-mail'}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="sr-only">
                                        {(role === 'motorista' || role === 'oficina') ? 'PIN de Acesso' : 'Palavra-passe'}
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
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
                                            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-14 text-base text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 focus:border-[#d8ab42] focus:ring-4 focus:ring-amber-100"
                                            placeholder={(role === 'motorista' || role === 'oficina') ? 'PIN de Acesso' : 'Palavra-passe'}
                                            maxLength={(role === 'motorista' || role === 'oficina') ? 6 : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={() => window.location.href = '/reset-password'}
                                        className="text-[0.92rem] font-semibold text-[#2c4e86] transition-colors hover:text-[#1f2957]"
                                    >
                                        Esqueceu a palavra-passe?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="mt-2 flex h-[3.55rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#d59d31_0%,#e8b547_40%,#ffcc58_100%)] px-6 text-[1.08rem] font-extrabold text-white shadow-[0_10px_20px_rgba(201,163,78,0.34)] transition-all hover:brightness-[1.02] active:translate-y-px"
                                >
                                    Iniciar Sessão
                                </button>

                                <div className="pt-2 text-center text-[0.98rem] text-slate-500">
                                    Precisa de ajuda?{' '}
                                    <a href="mailto:suporte@algartempo.com" className="font-semibold text-[#1f4f8b] hover:text-[#143a67]">
                                        Contacte o Suporte
                                    </a>
                                </div>

                                {(role === 'supervisor' || role === 'gestor') && (
                                    <button
                                        type="button"
                                        onClick={() => setShowRegistration(true)}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                    >
                                        Criar Conta {role === 'supervisor' ? 'Supervisor' : 'Gestor'}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => window.location.href = '/colaborador'}
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                                >
                                    É um colaborador? Aceder à Área
                                </button>
                            </form>
                        </div>
                    </section>
                </div>
            </div>

            {showRegistration && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <UserCog className={`w-5 h-5 ${role === 'supervisor' ? 'text-blue-500' : 'text-teal-500'}`} />
                                    {role === 'supervisor' ? 'Registo de Supervisor' : 'Registo de Gestor'}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {regStep === 'form' ? 'Preencha os seus dados' : 'Validação de Segurança'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRegistration(false)}
                                className="text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {regStep === 'form' ? (
                                <form onSubmit={handleRegistrationRequest} className="space-y-4">
                                    {regSuccess && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm flex items-center gap-2">
                                            <CheckCircle className="w-5 h-5" />
                                            {regSuccess}
                                        </div>
                                    )}

                                    {regError && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm flex items-center gap-2">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                            {regError}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Nome Completo</label>
                                        <input
                                            type="text"
                                            required
                                            value={regData.nome}
                                            onChange={e => setRegData({ ...regData, nome: e.target.value })}
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-1 focus:ring-amber-400 outline-none"
                                            placeholder="Ex: João Silva"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500 uppercase">Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={regData.email}
                                                onChange={e => setRegData({ ...regData, email: e.target.value })}
                                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-1 focus:ring-amber-400 outline-none"
                                                placeholder="email@algartempo.com"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500 uppercase">Telemóvel</label>
                                            <input
                                                type="tel"
                                                required
                                                value={regData.telemovel}
                                                onChange={e => setRegData({ ...regData, telemovel: e.target.value })}
                                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-1 focus:ring-amber-400 outline-none"
                                                placeholder="912 345 678"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Definir Palavra-Passe</label>
                                        <div className="relative">
                                            <input
                                                type={showRegPassword ? 'text' : 'password'}
                                                required
                                                value={regData.password}
                                                onChange={e => setRegData({ ...regData, password: e.target.value })}
                                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-1 focus:ring-amber-400 outline-none pr-10"
                                                placeholder="••••••••"
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowRegPassword(!showRegPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                                            >
                                                {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200 mt-4">
                                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
                                            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-700">
                                                Para concluir o registo, será enviado um pedido ao Administrador. Deverá aguardar que lhe seja fornecido um <strong>PIN de Confirmação</strong>.
                                            </p>
                                        </div>

                                        <button
                                            type="submit"
                                            className={`w-full text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${role === 'supervisor' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-teal-600 hover:bg-teal-500'}`}
                                        >
                                            <Send className="w-4 h-4" />
                                            Validar Dados e Pedir PIN
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setRegStep('verify')}
                                            className="w-full mt-3 text-slate-500 hover:text-slate-800 text-sm py-2"
                                        >
                                            Já tenho um PIN
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleConfirmation} className="space-y-6">
                                    <div className="text-center space-y-2">
                                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto border border-blue-200 mb-4">
                                            <Lock className="w-8 h-8 text-blue-500" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-900">Confirmação de Identidade</h3>
                                        <p className="text-sm text-slate-500">Introduza o PIN fornecido pelo Administrador.</p>
                                    </div>

                                    {regError && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm text-center">
                                            {regError}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500 uppercase">Email de Registo</label>
                                            <input
                                                type="email"
                                                required
                                                value={regData.email}
                                                onChange={e => setRegData({ ...regData, email: e.target.value })}
                                                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 focus:ring-1 focus:ring-amber-400 outline-none"
                                                placeholder="email@algartempo.com"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500 uppercase text-center block">PIN de Confirmação</label>
                                            <input
                                                type="text"
                                                required
                                                value={confirmPin}
                                                onChange={e => setConfirmPin(e.target.value)}
                                                className="w-full bg-white border border-slate-300 rounded-xl p-4 text-center text-2xl font-mono tracking-widest text-slate-900 focus:ring-2 focus:ring-amber-400 outline-none"
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
                                            className="w-full text-slate-500 hover:text-slate-800 text-sm py-2"
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
