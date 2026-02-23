
import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ElementType;
    actions?: React.ReactNode;
    children?: React.ReactNode; // For filters or extra toolbars below the main header
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
        <div className={`flex flex-col bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 transition-all duration-300 ${className}`}>
            <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* Left: Title & Info */}
                <div className="flex-1 min-w-0">
                    {/* Breadcrumbs (Optional) */}
                    {breadcrumbs && breadcrumbs.length > 0 && (
                        <nav className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-2">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    <span className={idx === breadcrumbs.length - 1 ? 'text-blue-400' : 'text-slate-500'}>
                                        {crumb.label}
                                    </span>
                                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 opacity-50" />}
                                </React.Fragment>
                            ))}
                        </nav>
                    )}

                    <div className="flex items-start gap-3">
                        {Icon && (
                            <div className="hidden md:flex p-3 rounded-2xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/10 text-blue-500 shrink-0">
                                <Icon className="w-6 h-6" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight truncate">
                                {title}
                            </h1>
                            {subtitle && (
                                <div className="text-slate-400 text-sm font-medium mt-1">
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
                <div className="pb-4 pt-0 border-t border-white/5 mt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="pt-4">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
