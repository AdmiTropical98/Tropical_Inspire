import React from 'react';
import { cn } from './FrotaCard';

interface FrotaPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode; // Buttons, DatePickers, etc.
  className?: string;
}

export function FrotaPageHeader({ title, subtitle, icon, actions, className }: FrotaPageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8", className)}>
      <div className="flex items-center gap-4">
        {icon && (
          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-blue-600">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm sm:text-base font-medium text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
