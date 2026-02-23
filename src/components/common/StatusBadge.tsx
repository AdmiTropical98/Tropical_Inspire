import React from 'react';

interface StatusBadgeProps {
    status: 'pending' | 'scheduled' | 'paid' | 'overdue';
    className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'pending':
                return {
                    label: 'Pendente',
                    bgColor: 'bg-slate-500/10',
                    textColor: 'text-slate-400',
                    borderColor: 'border-slate-500/20'
                };
            case 'scheduled':
                return {
                    label: 'Agendado',
                    bgColor: 'bg-blue-500/10',
                    textColor: 'text-blue-400',
                    borderColor: 'border-blue-500/20'
                };
            case 'paid':
                return {
                    label: 'Pago',
                    bgColor: 'bg-emerald-500/10',
                    textColor: 'text-emerald-400',
                    borderColor: 'border-emerald-500/20'
                };
            case 'overdue':
                return {
                    label: 'Vencido',
                    bgColor: 'bg-red-500/10',
                    textColor: 'text-red-400',
                    borderColor: 'border-red-500/20'
                };
            default:
                return {
                    label: status,
                    bgColor: 'bg-slate-500/10',
                    textColor: 'text-slate-400',
                    borderColor: 'border-slate-500/20'
                };
        }
    };

    const config = getStatusConfig(status);

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}>
            {config.label}
        </span>
    );
}