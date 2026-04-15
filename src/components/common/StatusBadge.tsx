import React from 'react';

interface StatusBadgeProps {
    status: 'pending' | 'scheduled' | 'paid' | 'overdue' | 'active' | 'warning' | 'offline' | 'inactive' | string;
    className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const getStatusConfig = (status: string) => {
        switch (status) {
            /* ── Financial statuses ─────────────────── */
            case 'pending':
                return { label: 'Pendente', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200', dot: 'bg-amber-400' };
            case 'scheduled':
                return { label: 'Agendado', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200', dot: 'bg-blue-400' };
            case 'paid':
                return { label: 'Pago', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', dot: 'bg-emerald-400' };
            case 'overdue':
                return { label: 'Vencido', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200', dot: 'bg-red-400' };
            /* ── Operational statuses ───────────────── */
            case 'active':
                return { label: 'Ativo', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', dot: 'bg-emerald-400' };
            case 'warning':
                return { label: 'Aviso', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200', dot: 'bg-amber-400' };
            case 'offline':
                return { label: 'Offline', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200', dot: 'bg-red-400' };
            case 'inactive':
                return { label: 'Inativo', bgColor: 'bg-slate-100', textColor: 'text-slate-500', borderColor: 'border-slate-200', dot: 'bg-slate-400' };
            default:
                return { label: status, bgColor: 'bg-slate-100', textColor: 'text-slate-500', borderColor: 'border-slate-200', dot: 'bg-slate-400' };
        }
    };

    const config = getStatusConfig(status);

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
            {config.label}
        </span>
    );
}
