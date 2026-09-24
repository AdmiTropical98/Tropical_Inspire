import React from 'react';
import { cn } from './FrotaCard';
import { Search, Filter } from 'lucide-react';

interface FrotaFilterBarProps {
  onSearchChange?: (val: string) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  children?: React.ReactNode; // Extra filters like selects
  className?: string;
}

export function FrotaFilterBar({ 
  onSearchChange, 
  searchValue, 
  searchPlaceholder = 'Pesquisar...', 
  children,
  className 
}: FrotaFilterBarProps) {
  return (
    <div className={cn("bg-white border border-slate-200/80 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-3 sm:p-4 flex flex-col lg:flex-row gap-4 items-center justify-between mb-6", className)}>
      
      {/* Search Input */}
      {onSearchChange !== undefined && (
        <div className="relative w-full lg:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}

      {/* Other Filters */}
      {children && (
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <div className="hidden lg:flex items-center justify-center p-2 text-slate-400 border-r border-slate-200 pr-4 mr-1">
            <Filter className="w-4 h-4" />
          </div>
          {children}
        </div>
      )}
      
    </div>
  );
}
