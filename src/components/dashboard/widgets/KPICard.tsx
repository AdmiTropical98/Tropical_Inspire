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
        blue: 'from-blue-500/10 to-blue-500/5 text-blue-500 border-blue-500/20',
        emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-500 border-emerald-500/20',
        amber: 'from-amber-500/10 to-amber-500/5 text-amber-500 border-amber-500/20',
        red: 'from-red-500/10 to-red-500/5 text-red-500 border-red-500/20',
        indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-500 border-indigo-500/20',
        purple: 'from-purple-500/10 to-purple-500/5 text-purple-500 border-purple-500/20',
    };

    const iconBgClasses = {
        blue: 'bg-blue-500/20',
        emerald: 'bg-emerald-500/20',
        amber: 'bg-amber-500/20',
        red: 'bg-red-500/20',
        indigo: 'bg-indigo-500/20',
        purple: 'bg-purple-500/20',
    };

    return (
        <div className={`
            relative overflow-hidden group h-full
            bg-slate-800/40 backdrop-blur-md border border-slate-700/50 
            hover:border-${color}-500/30 transition-all duration-300
            rounded-2xl p-6 flex flex-col justify-between
        `}>
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${iconBgClasses[color]} ${colorClasses[color].split(' ')[2]} group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-${color}-900/20`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={`
                            px-2 py-1 rounded-full text-xs font-medium flex items-center
                            ${trendType === 'up' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/10' : ''}
                            ${trendType === 'down' ? 'text-red-400 bg-red-500/10 border border-red-500/10' : ''}
                            ${trendType === 'neutral' ? 'text-slate-400 bg-slate-700/30' : ''}
                        `}>
                            {trendType === 'up' && '↑'}
                            {trendType === 'down' && '↓'}
                            <span className="ml-1">{trend}</span>
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
                        {subtext && <span className="text-sm text-slate-500 font-medium">{subtext}</span>}
                    </div>
                </div>
            </div>

            {/* Simulated Sparkline SVG */}
            <div className="absolute bottom-0 right-0 w-32 h-16 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <svg viewBox="0 0 100 50" className={`fill-current text-${color}-500`} preserveAspectRatio="none">
                    <path d="M0 50 L0 30 Q10 20 20 35 T40 25 T60 30 T80 15 L100 20 L100 50 Z" />
                </svg>
            </div>
        </div>
    );
}
