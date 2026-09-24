import React from 'react';
import { cn } from './FrotaCard';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface FrotaStatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  icon?: React.ReactNode;
}

export function FrotaStatusBadge({ label, variant = 'neutral', className, icon }: FrotaStatusBadgeProps) {
  
  const variants: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/60',
    error: 'bg-red-50 text-red-700 border-red-200/60',
    info: 'bg-sky-50 text-sky-700 border-sky-200/60',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
      variants[variant],
      className
    )}>
      {icon && <span className="w-3.5 h-3.5">{icon}</span>}
      {label}
    </span>
  );
}
