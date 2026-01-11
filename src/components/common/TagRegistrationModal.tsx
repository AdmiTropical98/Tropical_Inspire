import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, CreditCard, RefreshCw } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { getTagVariants } from '../../services/cartrack';

interface TagRegistrationModalProps {
    onSave: (tagId: string) => Promise<void>;
}

export default function TagRegistrationModal({ onSave }: TagRegistrationModalProps) {
    const { cartrackDrivers, motoristas, refreshData } = useWorkshop();
    const [tagInput, setTagInput] = useState('');
    const [status, setStatus] = useState<{ type: 'idle' | 'valid' | 'invalid' | 'taken', message?: string }>({ type: 'idle' });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const input = tagInput.trim().toUpperCase();
        if (!input) {
            setStatus({ type: 'idle' });
            return;
        }

        const inputVariants = getTagVariants(input);

        // Find match: if any input variant matches any official variant
        const match = cartrackDrivers.find(cd => {
            const officialVariants = cd.tagVariants || getTagVariants(cd.tagId);
            return inputVariants.some(iv =>
                officialVariants.some(ov => iv === ov || ov.includes(iv) || iv.includes(ov))
            );
        });

        if (!match) {
            setStatus({ type: 'invalid', message: 'Tag não reconhecida.' });
            return;
        }

        // Check if taken
        const matchTag = match.tagId?.toUpperCase();
        const isTaken = motoristas.some(m => {
            const mKey = (m as any).cartrackKey || (m as any).cartrack_key;
            if (!mKey) return false;
            return mKey.toUpperCase() === matchTag;
        });

        if (isTaken) {
            setStatus({ type: 'taken', message: 'Tag já registada.' });
        } else {
            setStatus({ type: 'valid', message: `Tag Válida: ${match.fullName}` });
        }
    }, [tagInput, cartrackDrivers, motoristas]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            await refreshData();
        } catch (e) {
            setError('Falha ao sincronizar dados da Cartrack.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status.type !== 'valid') return;

        setIsSaving(true);
        setError(null);
        try {
            const input = tagInput.trim().toUpperCase();
            const inputVariants = getTagVariants(input);
            const match = cartrackDrivers.find(cd => {
                const officialVariants = cd.tagVariants || getTagVariants(cd.tagId);
                return inputVariants.some(iv =>
                    officialVariants.some(ov => iv === ov || ov.includes(iv) || iv.includes(ov))
                );
            });

            await onSave(match?.tagId || tagInput.trim());
        } catch (err: any) {
            setError(err.message || 'Erro ao gravar Tag.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-6 mx-auto">
                        <CreditCard className="w-8 h-8 text-blue-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2">Registo de Chapinha</h2>
                    <p className="text-slate-400 text-center text-sm mb-8">
                        Para seres identificado automaticamente nas viaturas, introduz o número da tua **Tag Cartrack (chapinha)**.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">ID da tua Chapinha / Chave</label>
                            <div className="relative">
                                <input
                                    autoFocus
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    placeholder="Ex: 3D00... ou 0500..."
                                    className={`w-full bg-slate-950 border rounded-2xl px-6 py-5 text-white text-xl font-mono focus:outline-none transition-all placeholder:text-slate-800 ${status.type === 'valid' ? 'border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20' :
                                        status.type === 'idle' ? 'border-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500' :
                                            'border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                                        }`}
                                />
                                {status.type !== 'idle' && (
                                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${status.type === 'valid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                        {status.type === 'valid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                        {status.type === 'valid' ? 'Oficial' : status.message}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
                                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                    • Introduz o número que vês na tua chapinha física.
                                </p>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                    • O sistema valida automaticamente se é uma chave oficial da AlgaTempo.
                                </p>
                            </div>
                        </div>

                        {status.type === 'valid' && status.message?.includes(':') && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 animate-in fade-in slide-in-from-top-2">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Motorista Detetado</p>
                                    <p className="text-white font-bold">{status.message.split(': ')[1]}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {error && (
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 animate-in shake duration-300">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="w-full py-2 text-[10px] text-slate-500 hover:text-blue-400 uppercase font-bold tracking-widest transition-colors disabled:opacity-50 group flex items-center justify-center gap-2"
                            >
                                {isRefreshing ? (
                                    <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        Sincronizando com Cartrack...
                                    </>
                                ) : (
                                    'Não encontras a tua tag? Tenta Sincronizar'
                                )}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving || status.type !== 'valid'}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 text-lg"
                        >
                            {isSaving ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle2 className="w-6 h-6" />
                                    Gravar e Continuar
                                </>
                            )}
                        </button>
                    </form>
                </div>
                <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-800/50 flex justify-center">
                    <p className="text-[10px] text-slate-600 font-medium uppercase tracking-tight">
                        Tropical Inspire • Gestão de Frota
                    </p>
                </div>
            </div>
        </div>
    );
}
