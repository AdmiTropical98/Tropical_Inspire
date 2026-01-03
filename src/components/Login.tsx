import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkshop } from '../contexts/WorkshopContext';
import { Lock, Mail, ChevronRight, AlertCircle, Eye, EyeOff, User, ShieldCheck, UserCog, Send, CheckCircle, X, Wrench } from 'lucide-react';
import type { Notification } from '../types';

export default function Login() {
    const { login } = useAuth();
    const { addNotification, updateNotification, notifications, addSupervisor } = useWorkshop();
    const [role, setRole] = useState<'admin' | 'motorista' | 'supervisor' | 'oficina'>('admin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Registration Modal State
    const [showRegistration, setShowRegistration] = useState(false);
    const [regStep, setRegStep] = useState<'form' | 'verify'>('form');
    const [regData, setRegData] = useState({ nome: '', email: '', telemovel: '', password: '' });
    const [confirmPin, setConfirmPin] = useState('');
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = login(role, email, password);
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
                data: { ...regData },
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
            data: { ...regData },
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        addNotification(newNotification);
        setRegStep('verify');
        setRegSuccess('Pedido enviado! Aguarde que o administrador lhe envie o PIN de confirmação.');
    };

    const handleConfirmation = (e: React.FormEvent) => {
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
            // Create Supervisor
            addSupervisor({
                id: crypto.randomUUID(),
                nome: notification.data.nome || '',
                email: notification.data.email || '',
                telemovel: notification.data.telemovel || '',
                password: notification.data.password || '',
                pin: notification.response?.pin || '',
                status: 'active'
            });

            // Success & Close
            setShowRegistration(false);
            setRegData({ nome: '', email: '', telemovel: '', password: '' });
            setConfirmPin('');
            setRegStep('form');
            setEmail(notification.data.email || '');
            setRole('supervisor');
            setError(''); // Clear any prev errors
            alert('Conta criada com sucesso! Pode agora entrar.');
        } else {
            setRegError('PIN inválido ou pedido ainda não aprovado pelo administrador.');
        }
    };



    return (
        <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-start p-4 pt-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-xl relative z-10 flex flex-col items-center gap-0">
                <img
                    src="/logo-new.png"
                    alt="Logotipo"
                    className="h-96 w-auto object-contain drop-shadow-2xl"
                />

                <div className="w-full bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8 -mt-24">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo</h1>
                        <p className="text-slate-400">Selecione o seu perfil para entrar</p>
                    </div>

                    {/* Role Toggles */}
                    <div className="grid grid-cols-4 gap-2 p-1 bg-slate-900/50 rounded-xl mb-8 border border-slate-700/50">
                        <button
                            onClick={() => { setRole('admin'); setError(''); }}
                            className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all
                            ${role === 'admin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                        `}
                        >
                            <ShieldCheck className="w-5 h-5" />
                            Admin
                        </button>
                        <button
                            onClick={() => { setRole('supervisor'); setError(''); }}
                            className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all
                            ${role === 'supervisor' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                        `}
                        >
                            <UserCog className="w-5 h-5" />
                            Superv.
                        </button>
                        <button
                            onClick={() => { setRole('oficina'); setError(''); }}
                            className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all
                            ${role === 'oficina' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                        `}
                        >
                            <Wrench className="w-5 h-5" />
                            Oficina
                        </button>
                        <button
                            onClick={() => { setRole('motorista'); setError(''); }}
                            className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all
                            ${role === 'motorista' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                        `}
                        >
                            <User className="w-5 h-5" />
                            Motorista
                        </button>
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
                                {role === 'motorista' ? 'Telemóvel ou Email' : 'Email'}
                            </label>
                            <div className="relative group">
                                {role === 'admin' ? (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                ) : role === 'supervisor' ? (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                ) : role === 'oficina' ? (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                                ) : (
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                )}
                                <input
                                    type="text"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-4 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder={
                                        role === 'admin' ? "admin@algartempo.com" :
                                            role === 'supervisor' ? "supervisor@algartempo.com" :
                                                role === 'oficina' ? "oficina@algartempo.com" :
                                                    "Telemóvel ou Email"
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
                                            role === 'oficina' ? 'group-focus-within:text-orange-400' :
                                                'group-focus-within:text-emerald-400'}
                                `} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-12 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder={role === 'admin' || role === 'supervisor' ? "••••••••" : "0000"}
                                    maxLength={(role === 'motorista' || role === 'oficina') ? (role === 'oficina' ? 4 : 6) : undefined}
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

                        <button
                            type="submit"
                            className={`w-full text-white font-bold py-4 rounded-xl shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 group
                            ${role === 'admin'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/20 hover:shadow-blue-900/40'
                                    : role === 'supervisor'
                                        ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-purple-900/20 hover:shadow-purple-900/40'
                                        : role === 'oficina'
                                            ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-orange-900/20 hover:shadow-orange-900/40'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/20 hover:shadow-emerald-900/40'
                                }
                        `}
                        >
                            Entrar
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    {role === 'supervisor' && (
                        <div className="mt-6 border-t border-slate-800/50 pt-4">
                            <button
                                onClick={() => setShowRegistration(true)}
                                className="w-full py-3 rounded-xl border border-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <UserCog className="w-4 h-4" />
                                Registar Nova Conta Supervisor
                            </button>
                        </div>
                    )}

                    <p className="mt-8 text-center text-xs text-slate-600">
                        &copy; 2025 Algartempo Frota. Todos os direitos reservados.
                    </p>
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
                                    <UserCog className="w-5 h-5 text-purple-500" />
                                    Registo de Supervisor
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
                                        <input
                                            type="password"
                                            required
                                            value={regData.password}
                                            onChange={e => setRegData({ ...regData, password: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                            placeholder="••••••••"
                                            minLength={6}
                                        />
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
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
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
