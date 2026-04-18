import { useState } from 'react';
import { Mail, RefreshCw, LogOut, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function VerifyEmail() {
    const { currentUser, logout } = useAuth();
    const [isResending, setIsResending] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleResend = async () => {
        if (!currentUser?.email) return;
        setIsResending(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: currentUser.email,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });

            if (error) throw error;
            setMessage({ text: 'Email de confirmação enviado com sucesso! Verifique a sua caixa de entrada.', type: 'success' });
        } catch (error: any) {
            console.error('Error resending confirmation:', error);
            setMessage({ text: `Erro ao enviar: ${error.message || 'Tente novamente mais tarde.'}`, type: 'error' });
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="android-page-shell min-h-screen w-full flex items-center justify-center bg-black p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
            </div>

            <div className="android-page-card w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 relative z-10 shadow-2xl">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-10 h-10 text-blue-400" />
                    </div>

                    <h1 className="text-2xl font-bold text-white">Confirme o seu Email</h1>
                    <p className="text-slate-400">
                        Obrigado por se registar! Enviámos um link de confirmação para:
                        <br />
                        <span className="text-blue-400 font-medium mt-1 font-mono text-sm inline-block">{currentUser?.email}</span>
                    </p>

                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-xs text-left space-y-2 mt-6">
                        <div className="flex gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-500/60 shrink-0" />
                            <p className="text-slate-300">O seu acesso ficará limitado até que a conta seja verificada.</p>
                        </div>
                        <div className="flex gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-500/60 shrink-0" />
                            <p className="text-slate-300">O link de confirmação expira em 24 horas.</p>
                        </div>
                        <div className="flex gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500/60 shrink-0" />
                            <p className="text-slate-300">Não recebeu? Verifique a pasta de Spam.</p>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 pt-4">
                        <button
                            onClick={handleResend}
                            disabled={isResending}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className={`w-5 h-5 ${isResending ? 'animate-spin' : ''}`} />
                            {isResending ? 'A enviar...' : 'Reenviar Email'}
                        </button>

                        <button
                            onClick={logout}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-5 h-5" />
                            Sair da Conta
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-slate-600 text-[10px] uppercase tracking-widest font-black">AlgarTempo Frota &bull; Segurança</p>
                </div>
            </div>
        </div>
    );
}
