import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Eye, EyeOff, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

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
            const { error } = await supabase.auth.updateUser({ password: password });

            if (error) throw error;

            setSuccess(true);
            // Optional: helper to clear hash or redirect
            setTimeout(() => {
                window.location.hash = '';
                window.location.href = '/'; // Force redirect to login/home
            }, 3000);

        } catch (err) {
            console.error('Reset password error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar palavra-passe.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="android-page-shell min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-4">
                <div className="android-page-card w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Palavra-passe Atualizada!</h2>
                        <p className="text-slate-600">
                            A sua palavra-passe foi alterada com sucesso.
                            <br />
                            A redirecionar para a aplicação...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="android-page-shell h-[100dvh] bg-[#F5F7FA] flex flex-col items-center px-4 pt-0 pb-4 relative login-scrollbar overflow-y-auto app-content-bg">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-100/30 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/30 blur-[120px] rounded-full"></div>
            </div>

            <div className="android-page-card w-full max-w-md relative z-10 -mt-8">
                <div className="text-center mb-2">
                    <img
                        src="/LOGO.png"
                        alt="Algar Frota"
                        className="w-72 h-auto object-contain mx-auto mb-2"
                    />
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Redefinir Palavra-passe</h1>
                    <p className="text-slate-600">Escolha uma nova palavra-passe segura</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 relative z-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-600 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    Nova Palavra-Passe
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    Confirmar Palavra-Passe
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl py-3.5 pl-12 pr-12 text-slate-900 focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#C9A34E] hover:bg-[#b8903d] text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-200 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'A Guardar...' : 'Atualizar Palavra-passe'}
                            {!loading && <ChevronRight className="w-5 h-5" />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
