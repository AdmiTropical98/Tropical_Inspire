import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { Lock, Mail, ChevronRight, AlertCircle, Eye, EyeOff, User, Users, ShieldCheck, UserCog, Send, CheckCircle, X, Wrench, UserCheck } from 'lucide-react';
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
    const [role, setRoleState] = useState<'admin' | 'gestor'>(() => {
        const saved = localStorage.getItem('last_login_role');
        return saved === 'gestor' ? 'gestor' : 'admin';
    });

    const setRole = (newRole: 'admin' | 'gestor') => {
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
        const success = await login(role, email, password, 'frota');
        if (!success) {
            if (role === 'gestor') {
                setError('Email/telemóvel ou PIN/palavra-passe incorretos.');
            } else {
                setError('Email ou palavra-passe incorretos.');
            }
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
        <div
            className="login-scrollbar relative min-h-[100dvh] overflow-x-hidden overflow-y-auto text-white"
            style={{
                backgroundImage: "url('/loginfrota.png')",
                backgroundSize: 'cover',
                backgroundPosition: isCapacitorAndroid ? 'center' : 'center center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_55%,rgba(11,58,180,0.16),transparent_45%),linear-gradient(92deg,rgba(2,9,34,0.68)_0%,rgba(2,9,34,0.35)_42%,rgba(2,9,34,0.70)_100%)]" />
            <div className="absolute inset-0 z-0 backdrop-blur-[0.5px]" />

            <div className={`android-page-shell relative z-10 flex min-h-[100dvh] w-full ${isCapacitorAndroid ? 'android-native-shell mx-0 max-w-[100vw] items-start justify-start px-0 py-0' : 'mx-auto max-w-[1500px] items-center justify-center px-4 py-6 sm:px-8 lg:px-16 xl:px-20'}`}>
                <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1.12fr_0.78fr] lg:gap-12">
                    <section className="relative hidden min-h-[600px] items-center justify-center lg:flex lg:justify-start">
                        <div className="w-full max-w-[760px] px-2">
                            <img
                                src="/LOGO22.png"
                                alt="Algartempo Frota"
                                className="w-full max-w-[620px] object-contain drop-shadow-[0_14px_30px_rgba(28,96,255,0.25)]"
                            />
                            <p className="-mt-6 whitespace-nowrap text-[30px] font-semibold tracking-[-0.02em] text-white/88">Gestão inteligente. Frota eficiente.</p>
                        </div>
                    </section>

                    <section className="flex items-center justify-center lg:justify-end">
                        <div className="android-page-card auth-card w-full max-w-[470px] rounded-[34px] border border-[#2a6dff66] bg-[linear-gradient(165deg,rgba(6,22,70,0.90),rgba(3,13,44,0.92))] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.45),0_0_32px_rgba(45,118,255,0.35),inset_0_0_0_1px_rgba(105,162,255,0.18)] backdrop-blur-xl sm:p-10">
                            <div className="mb-5 flex items-center gap-3 sm:hidden">
                                <img
                                    src="/LOGO22.png"
                                    alt="Algartempo Frota"
                                    className="h-14 w-auto"
                                />
                            </div>

                            <div className="mb-8 flex items-center justify-start">
                                <div className="relative w-full max-w-[220px]">
                                    <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#4f96ff]">
                                        {roleConfig[role].icon}
                                    </div>
                                    <select
                                        value={role}
                                        onChange={(e) => {
                                            setRole(e.target.value as any);
                                            setError('');
                                        }}
                                        className="h-11 w-full appearance-none rounded-full border border-[#3574e760] bg-[#071e53bb] pl-12 pr-10 text-[12px] font-bold uppercase tracking-[0.16em] text-white/85 outline-none transition-colors focus:border-[#4a8dff]"
                                    >
                                        {Object.entries(roleConfig).map(([key, config]) => (
                                            <option key={key} value={key} className="text-slate-900">{config.label}</option>
                                        ))}
                                    </select>
                                    <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-white/70" />
                                </div>
                            </div>

                            <div className="mb-8">
                                <p className="inline-flex items-center rounded-full bg-[#0d3a8a] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#75afff]">
                                    Sistema Frota
                                </p>
                                <h1 className="mt-3 text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-[3.15rem]">
                                    Bem-vindo de
                                    <span className="block text-[#2f7cff]">volta!</span>
                                </h1>
                                <p className="mt-3 text-[1.06rem] text-[#c9d9ffcc]">Inicie sessão para continuar.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="flex items-center gap-3 rounded-2xl border border-red-400/50 bg-red-950/35 px-4 py-3 text-sm text-red-100">
                                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="sr-only">
                                        {role === 'gestor' ? 'Email ou Telemovel' : 'Endereco de E-mail'}
                                    </label>
                                    <div className="relative">
                                        {(role === 'admin' || role === 'gestor') ? (
                                            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a6c4ff99]" />
                                        ) : (
                                            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a6c4ff99]" />
                                        )}
                                        <input
                                            type={role === 'gestor' ? 'text' : 'email'}
                                            inputMode={role === 'gestor' ? 'text' : 'email'}
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="h-[54px] w-full rounded-2xl border border-[#8db1ef7a] bg-[#081c53bf] pl-12 pr-4 text-base text-white outline-none transition-all placeholder:text-[#9eb8ec99] focus:border-[#9ec2ff] focus:ring-2 focus:ring-[#2a6dff55]"
                                            placeholder={role === 'gestor' ? 'Email ou Telemovel' : 'Endereco de E-mail'}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="sr-only">
                                        {role === 'gestor' ? 'PIN ou Palavra-passe' : 'Palavra-passe'}
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a6c4ff99]" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            inputMode={role === 'gestor' ? 'text' : 'text'}
                                            required
                                            value={password}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPassword(val);
                                            }}
                                            className="h-[54px] w-full rounded-2xl border border-[#8db1ef7a] bg-[#081c53bf] pl-12 pr-14 text-base text-white outline-none transition-all placeholder:text-[#9eb8ec99] focus:border-[#9ec2ff] focus:ring-2 focus:ring-[#2a6dff55]"
                                            placeholder={role === 'gestor' ? 'PIN ou Palavra-passe' : 'Palavra-passe'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a6c4ff99] transition-colors hover:text-white"
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={() => window.location.href = '/reset-password'}
                                        className="text-[0.96rem] font-semibold text-[#2d82ff] transition-colors hover:text-[#60a8ff]"
                                    >
                                        Esqueceu a palavra-passe?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="mt-2 flex h-[3.3rem] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#bd871f_0%,#d89e33_45%,#e9b548_100%)] px-6 text-[1.1rem] font-extrabold text-white shadow-[0_8px_18px_rgba(194,136,25,0.36)] transition-all hover:brightness-105 active:translate-y-px"
                                >
                                    Iniciar Sessao
                                    <ChevronRight className="h-5 w-5" />
                                </button>

                                <div className="pt-2 text-center text-[0.98rem] text-[#c9d9ffcc]">
                                    Precisa de ajuda?{' '}
                                    <a href="mailto:suporte@algartempo.com" className="font-semibold text-[#2d82ff] hover:text-[#60a8ff]">
                                        Contacte o Suporte
                                    </a>
                                </div>

                                {(role === 'supervisor' || role === 'gestor') && (
                                    <button
                                        type="button"
                                        onClick={() => setShowRegistration(true)}
                                        className="w-full rounded-2xl border border-[#4f72b766] bg-[#0b2458cc] py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-[#11306fdd]"
                                    >
                                        Criar Conta {role === 'supervisor' ? 'Supervisor' : 'Gestor'}
                                    </button>
                                )}
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
