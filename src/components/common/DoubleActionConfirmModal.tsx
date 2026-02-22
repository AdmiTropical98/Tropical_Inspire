import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface DoubleActionConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    requireTypeConfirm?: boolean;
    critical?: boolean;
}

export default function DoubleActionConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    requireTypeConfirm = false,
    critical = true
}: DoubleActionConfirmModalProps) {
    const [typedConfirm, setTypedConfirm] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (requireTypeConfirm && typedConfirm !== 'CONFIRMAR') return;
        onConfirm();
        setTypedConfirm('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#0f172a] w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className={`p-6 flex flex-col items-center text-center ${critical ? 'bg-red-500/5' : 'bg-blue-500/5'}`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${critical ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {critical ? <AlertTriangle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {requireTypeConfirm && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                                Escreva <span className="text-white">CONFIRMAR</span> para prosseguir
                            </label>
                            <input
                                type="text"
                                value={typedConfirm}
                                onChange={(e) => setTypedConfirm(e.target.value.toUpperCase())}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="DIGITE AQUI"
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleConfirm}
                            disabled={requireTypeConfirm && typedConfirm !== 'CONFIRMAR'}
                            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${(requireTypeConfirm && typedConfirm !== 'CONFIRMAR')
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : critical ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                                }`}
                        >
                            {confirmText}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-4 text-slate-400 font-bold hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
