import React, { useState } from 'react';
import { CreditCard, Save, AlertCircle } from 'lucide-react';

interface TagRegistrationModalProps {
    onSave: (tagId: string) => Promise<void>;
}

export default function TagRegistrationModal({ onSave }: TagRegistrationModalProps) {
    const [tagId, setTagId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tagId.trim()) return;

        setIsSaving(true);
        setError(null);
        try {
            // Clean/Format Tag ID if needed (drivers might paste UUIDs)
            let formattedTag = tagId.trim().toUpperCase();
            if (formattedTag.includes('-')) {
                formattedTag = formattedTag.split('-').pop()! || formattedTag;
            }
            // Remove leading zeros as we do in the cartrack service mapping
            formattedTag = formattedTag.replace(/^0+/, '');

            await onSave(formattedTag);
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

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Número da Tag (ID)</label>
                            <input
                                autoFocus
                                type="text"
                                value={tagId}
                                onChange={(e) => setTagId(e.target.value)}
                                placeholder="Ex: 1A7F485"
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-700"
                                required
                            />
                            <p className="mt-2 text-[10px] text-slate-500 leading-relaxed px-1">
                                Usa o número que aparece na parte de trás da chapinha ou o código curto.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 text-red-400 text-xs animate-in shake duration-300">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving || !tagId.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-lg"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Gravar e Continuar
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-slate-950/50 p-4 border-t border-slate-800/50">
                    <p className="text-[10px] text-slate-600 text-center uppercase tracking-tighter">
                        Tropical Inspire &bull; Gestão de Frota
                    </p>
                </div>
            </div>
        </div>
    );
}
