import { useState, useEffect } from 'react';
import { useWorkshop } from '../contexts/WorkshopContext';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';

export default function SetupSupervisor() {
    const { supervisors, updateSupervisor } = useWorkshop();
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        const pinParam = params.get('pin');
        if (emailParam) setEmail(emailParam);
        if (pinParam) setPin(pinParam);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        const supervisor = supervisors.find(s => 
            s.email.toLowerCase() === email.toLowerCase() && 
            s.pin === pin
        );

        if (!supervisor) {
            setError('Email ou PIN inválidos. Por favor, verifique os dados recebidos.');
            setLoading(false);
            return;
        }

        if (supervisor.status === 'active' && supervisor.password) {
            setError('Esta conta já foi configurada. Por favor, use o login normal.');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('As palavras-passe não coincidem.');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('A palavra-passe deve ter pelo menos 6 caracteres.');
            setLoading(false);
            return;
        }

        try {
            // Update Supervisor
            await updateSupervisor({
                ...supervisor,
                password: password,
                status: 'active'
            });

            setSuccess(true);
            setTimeout(() => {
                window.location.href = '/'; // Redirect to login
            }, 3000);

        } catch (err: any) {
            console.error('Setup password error:', err);
            setError('Erro ao configurar palavra-passe.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Conta Configurada!</h2>
                        <p className="text-slate-400">
                            A sua conta de Supervisor foi ativada com sucesso.
                            <br />
                            A redirecionar para o login...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <img
                        src="/logo-new.png"
                        alt="Logotipo"
                        className="h-24 w-auto object-contain mx-auto mb-6 drop-shadow-2xl"
                    />
                    <h1 className="text-3xl font-bold text-white mb-2">Configurar Supervisor</h1>
                    <p className="text-slate-400">Ative sua conta e defina sua palavra-passe</p>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 px-4 text-slate-200 mt-1 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="seu@email.com"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">PIN de Ativação</label>
                                <input
                                    type="text"
                                    required
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 px-4 text-slate-200 mt-1 outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.5em] text-center font-mono"
                                    placeholder="000000"
                                    maxLength={6}
                                />
                            </div>

                            <hr className="border-slate-700/50 my-2" />

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nova Palavra-Passe</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-12 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirmar Palavra-Passe</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-12 pr-12 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'A Ativar...' : 'Ativar Conta'}
                            {!loading && <ShieldCheck className="w-5 h-5" />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
