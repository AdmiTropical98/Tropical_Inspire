import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ElementType;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    breadcrumbs?: { label: string; href?: string }[];
}

export default function PageHeader({
    title,
    subtitle,
    icon: Icon,
    actions,
    children,
    className = '',
    breadcrumbs
}: PageHeaderProps) {
    return (
        <div className={`flex flex-col bg-white/90 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30 transition-all duration-300 ${className}`} style={{ boxShadow: '0 4px 16px -6px rgba(15,23,42,0.10)' }}>
            <div className="px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* Left: Title & Info */}
                <div className="flex-1 min-w-0">
                    {/* Breadcrumbs (Optional) */}
                    {breadcrumbs && breadcrumbs.length > 0 && (
                        <nav className="flex items-center gap-1 text-xs font-medium text-slate-400 mb-1.5">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    <span className={idx === breadcrumbs.length - 1 ? 'text-[#C9A34E] font-semibold' : 'text-slate-400'}>
                                        {crumb.label}
                                    </span>
                                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 opacity-40" />}
                                </React.Fragment>
                            ))}
                        </nav>
                    )}

                    <div className="flex items-start gap-3">
                        {Icon && (
                            <div className="hidden md:flex p-2.5 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100/80 text-amber-600 shrink-0">
                                <Icon className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold text-[#1f2957] tracking-tight leading-tight truncate">
                                {title}
                            </h1>
                            {subtitle && (
                                <div className="text-slate-500 text-sm font-medium mt-0.5">
                                    {subtitle}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                {actions && (
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                        {actions}
                    </div>
                )}
            </div>

            {/* Bottom: Children (Filters/Toolbars) */}
            {children && (
                <div className="px-4 md:px-8 pb-4 pt-0 border-t border-slate-100/80 mt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="pt-3">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
