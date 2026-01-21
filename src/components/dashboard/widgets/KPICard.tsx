import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendType?: 'up' | 'down' | 'neutral';
    color: 'blue' | 'emerald' | 'amber' | 'red' | 'indigo' | 'purple';
    subtext?: string;
}

export default function KPICard({ title, value, icon: Icon, trend, trendType = 'neutral', color, subtext }: KPICardProps) {
    const colorClasses = {
        blue: 'from-blue-600/20 to-blue-400/5 text-blue-400 border-blue-500/20 shadow-blue-900/10',
        emerald: 'from-emerald-600/20 to-emerald-400/5 text-emerald-400 border-emerald-500/20 shadow-emerald-900/10',
        amber: 'from-amber-600/20 to-amber-400/5 text-amber-400 border-amber-500/20 shadow-amber-900/10',
        red: 'from-red-600/20 to-red-400/5 text-red-400 border-red-500/20 shadow-red-900/10',
        indigo: 'from-indigo-600/20 to-indigo-400/5 text-indigo-400 border-indigo-500/20 shadow-indigo-900/10',
        purple: 'from-purple-600/20 to-purple-400/5 text-purple-400 border-purple-500/20 shadow-purple-900/10',
    };

    const iconBgClasses = {
        blue: 'bg-blue-500/10',
        emerald: 'bg-emerald-500/10',
        amber: 'bg-amber-500/10',
        red: 'bg-red-500/10',
        indigo: 'bg-indigo-500/10',
        purple: 'bg-purple-500/10',
    };

    // Unique sparkline paths per color to create visual variety
    const paths = {
        blue: "M0 40 L10 35 L20 38 L30 25 L40 30 L50 20 L60 25 L70 15 L80 18 L90 10 L100 15 V 50 H 0 Z",
        emerald: "M0 45 L15 40 L30 42 L45 30 L60 35 L75 25 L90 20 L100 15 V 50 H 0 Z",
        amber: "M0 35 L20 38 L40 25 L60 30 L80 20 L100 25 V 50 H 0 Z",
        red: "M0 20 L20 25 L40 35 L60 30 L80 40 L100 45 V 50 H 0 Z", // Trending down visual
        indigo: "M0 40 Q25 35 50 20 T100 15 V 50 H 0 Z", // Smooth curve
        purple: "M0 50 L10 40 L20 45 L30 35 L40 40 L50 30 L60 25 L70 35 L80 20 L90 25 L100 20 V 50 H 0 Z",
    };

    return (
        <div className={`
            relative overflow-hidden group h-full
            bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 
            hover:border-${color}-500/50 transition-all duration-500
            rounded-2xl p-6 flex flex-col justify-between
            shadow-lg hover:shadow-2xl hover:shadow-${color}-500/10
        `}>
            {/* Background Gradient - Stronger on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-30 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none`} />

            {/* Radical sheen effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`
                        p-3 rounded-2xl ${iconBgClasses[color]} 
                        text-${color}-400 ring-1 ring-${color}-500/20
                        group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 
                        shadow-lg shadow-${color}-900/20
                    `}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={`
                            px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1
                            backdrop-blur-md border shadow-sm
                            ${trendType === 'up' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : ''}
                            ${trendType === 'down' ? 'text-red-400 bg-red-500/10 border-red-500/20' : ''}
                            ${trendType === 'neutral' ? 'text-slate-400 bg-slate-700/50 border-slate-600/30' : ''}
                        `}>
                            {trendType === 'up' && <span className="text-xs">▲</span>}
                            {trendType === 'down' && <span className="text-xs">▼</span>}
                            <span>{trend}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest opacity-80">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">{value}</span>
                        {subtext && <span className="text-sm text-slate-500 font-semibold">{subtext}</span>}
                    </div>
                </div>
            </div>

            {/* Dynamic Sparkline SVG */}
            <div className="absolute bottom-0 left-0 right-0 h-24 opacity-20 group-hover:opacity-30 transition-all duration-500 pointer-events-none translate-y-4 group-hover:translate-y-2">
                <svg viewBox="0 0 100 50" className={`fill-current text-${color}-500 w-full h-full`} preserveAspectRatio="none">
                    <path d={paths[color]} />
                </svg>
            </div>

            {/* Top Border Highlight */}
            <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-${color}-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        </div>
    );
}
