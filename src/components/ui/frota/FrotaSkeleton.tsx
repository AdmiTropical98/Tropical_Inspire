import React from 'react';
import { cn } from './FrotaCard';

export function FrotaSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-slate-200/60 rounded-md", className)} />
  );
}

export function FrotaCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <FrotaSkeleton className="h-4 w-1/3" />
        <FrotaSkeleton className="h-8 w-8 rounded-xl" />
      </div>
      <FrotaSkeleton className="h-8 w-1/2" />
      <FrotaSkeleton className="h-3 w-1/4 mt-2" />
    </div>
  );
}
