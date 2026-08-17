import React from 'react';
import { cn } from './FrotaCard';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FrotaKPIProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number; // positive = up, negative = down
  trendLabel?: string;
  trendType?: 'good' | 'bad' | 'neutral'; // 'good' means positive trend is good (e.g. revenue). 'bad' means positive trend is bad (e.g. costs)
  className?: string;
  onClick?: () => void;
}

export function FrotaKPI({ 
  title, 
  value, 
  icon, 
  trend, 
  trendLabel, 
  trendType = 'neutral',
  className,
  onClick
}: FrotaKPIProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;
  
  let trendColor = 'text-slate-500';
  if (trendType === 'good') {
    if (isPositive) trendColor = 'text-emerald-500 bg-emerald-50';
    if (isNegative) trendColor = 'text-rose-500 bg-rose-50';
  } else if (trendType === 'bad') {
    if (isPositive) trendColor = 'text-rose-500 bg-rose-50';
    if (isNegative) trendColor = 'text-emerald-500 bg-emerald-50';
  }

  return (
    <div 
      className={cn(
        "bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group",
        onClick && "cursor-pointer active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 tracking-tight">{title}</h3>
        {icon && (
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900 tracking-tight">{value}</span>
      </div>

      {trend !== undefined && (
        <div className={cn("flex items-center gap-1.5 mt-3 text-sm font-semibold", trendColor)}>
          <TrendIcon className="w-4 h-4" strokeWidth={3} />
          <span>{Math.abs(trend)}%</span>
          {trendLabel && <span className="text-slate-400 ml-1 font-medium">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
