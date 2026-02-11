import React, { useMemo } from 'react';
import { X, Check, AlertTriangle, FileSpreadsheet, ArrowRight } from 'lucide-react';

export interface ImportRow {
    index: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>; // Key-Value relevant for display
    status: 'valid' | 'error';
    errors?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any; // The actual data to insert if valid
}

interface ImportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    rows: ImportRow[];
    title: string;
    isSubmitting: boolean;
}

export default function ImportPreviewModal({
    isOpen,
    onClose,
    onConfirm,
    rows,
    title,
    isSubmitting
}: ImportPreviewModalProps) {
    if (!isOpen) return null;

    const stats = useMemo(() => {
        return {
            total: rows.length,
            valid: rows.filter(r => r.status === 'valid').length,
            invalid: rows.filter(r => r.status === 'error').length
        };
    }, [rows]);

    const formatVal = (val: unknown) => {
        if (typeof val === 'number') return val.toLocaleString('pt-PT', { maximumFractionDigits: 3 });
        if (val instanceof Date) return val.toLocaleDateString('pt-PT');
        return String(val);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{title}</h2>
                            <p className="text-slate-400 text-sm">Verifique os dados antes de importar</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-4 p-6 bg-slate-950 border-b border-slate-800">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Total de Linhas</p>
                        <p className="text-3xl font-black text-white">{stats.total}</p>
                    </div>
                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                        <p className="text-emerald-500 text-xs uppercase font-bold tracking-wider mb-1">Válidos</p>
                        <p className="text-3xl font-black text-emerald-400">{stats.valid}</p>
                    </div>
                    <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                        <p className="text-red-500 text-xs uppercase font-bold tracking-wider mb-1">Com Erros</p>
                        <p className="text-3xl font-black text-red-400">{stats.invalid}</p>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto bg-slate-950 relative">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-xs tracking-wider border-b border-slate-800">Linha</th>
                                <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-xs tracking-wider border-b border-slate-800">Status</th>
                                <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-xs tracking-wider border-b border-slate-800">Dados Detalhados</th>
                                <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-xs tracking-wider border-b border-slate-800">Erros detetados</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {rows.map((row) => (
                                <tr key={row.index} className={`hover:bg-slate-900/50 transition-colors ${row.status === 'error' ? 'bg-red-500/5' : ''}`}>
                                    <td className="py-3 px-4 text-slate-500 font-mono align-top w-16">#{row.index}</td>
                                    <td className="py-3 px-4 align-top w-24">
                                        {row.status === 'valid' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                                <Check className="w-3.5 h-3.5" /> OK
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                                                <X className="w-3.5 h-3.5" /> Erro
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-slate-300">
                                            {Object.entries(row.data).map(([key, value]) => (
                                                <div key={key} className="flex flex-col">
                                                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{key}</span>
                                                    <span className={`font-mono text-xs truncate ${key.toLowerCase().includes('raw') ? 'text-slate-500' : 'text-blue-100'}`} title={String(value)}>
                                                        {formatVal(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                        {row.errors && row.errors.length > 0 ? (
                                            <ul className="space-y-2">
                                                {row.errors.map((err, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 p-2 rounded border border-red-500/10">
                                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                        <span>{err}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-slate-600 text-xs italic">Sem erros</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting || stats.valid === 0}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 flex items-center gap-2.5"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                A Importar...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Confirmar Importação ({stats.valid})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
