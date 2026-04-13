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
        <div className={`flex flex-col bg-white border-b border-slate-200 sticky top-0 z-30 transition-all duration-300 shadow-[0_4px_14px_-10px_rgba(15,23,42,0.35)] ${className}`}>
            <div className="px-4 md:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* Left: Title & Info */}
                <div className="flex-1 min-w-0">
                    {/* Breadcrumbs (Optional) */}
                    {breadcrumbs && breadcrumbs.length > 0 && (
                        <nav className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-2">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    <span className={idx === breadcrumbs.length - 1 ? 'text-[#C9A34E]' : 'text-slate-500'}>
                                        {crumb.label}
                                    </span>
                                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 opacity-50" />}
                                </React.Fragment>
                            ))}
                        </nav>
                    )}

                    <div className="flex items-start gap-3">
                        {Icon && (
                            <div className="hidden md:flex p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 text-blue-700 shrink-0">
                                <Icon className="w-6 h-6" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                                {title}
                            </h1>
                            {subtitle && (
                                <div className="text-slate-600 text-sm font-medium mt-1">
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
                <div className="px-4 md:px-8 pb-4 pt-0 border-t border-slate-100 mt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="pt-4">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
