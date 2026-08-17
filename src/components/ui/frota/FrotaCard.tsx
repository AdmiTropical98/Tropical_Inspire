import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FrotaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export function FrotaCard({ className, children, noPadding = false, ...props }: FrotaCardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-shadow',
        !noPadding && 'p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
