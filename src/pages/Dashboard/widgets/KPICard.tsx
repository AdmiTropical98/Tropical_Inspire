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

    // Mesh Gradient Backgrounds per color
    const gradients = {
        blue: 'from-blue-600/30 via-blue-900/10 to-transparent',
        emerald: 'from-emerald-600/30 via-emerald-900/10 to-transparent',
        amber: 'from-amber-600/30 via-amber-900/10 to-transparent',
        red: 'from-red-600/30 via-red-900/10 to-transparent',
        indigo: 'from-indigo-600/30 via-indigo-900/10 to-transparent',
        purple: 'from-purple-600/30 via-purple-900/10 to-transparent',
    };

    const iconColors = {
        blue: 'text-blue-400 bg-blue-400/10 ring-blue-400/20',
        emerald: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20',
        amber: 'text-amber-400 bg-amber-400/10 ring-amber-400/20',
        red: 'text-red-400 bg-red-400/10 ring-red-400/20',
        indigo: 'text-indigo-400 bg-indigo-400/10 ring-indigo-400/20',
        purple: 'text-purple-400 bg-purple-400/10 ring-purple-400/20',
    };

    return (
        <div className="relative h-full overflow-hidden rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-white/5 flex flex-col group transition-all duration-500 hover:border-white/10 hover:shadow-2xl">

            {/* Ambient Glow */}
            <div className={`absolute top-0 right-0 w-[80%] h-[80%] bg-gradient-to-br ${gradients[color]} blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none -mr-10 -mt-10`} />

            <div className="relative z-10 p-6 flex flex-col h-full justify-between">

                {/* Header: Icon + Title */}
                <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl ring-1 inset-ring ${iconColors[color]} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md
                            ${trendType === 'up' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : ''}
                            ${trendType === 'down' ? 'text-red-400 border-red-500/20 bg-red-500/10' : ''}
                            ${trendType === 'neutral' ? 'text-slate-400 border-slate-700 bg-slate-800/50' : ''}
                        `}>
                            {trendType === 'up' && '↑'}
                            {trendType === 'down' && '↓'}
                            {trend}
                        </div>
                    )}
                </div>

                {/* Content: Value + Subtext */}
                <div className="space-y-1 mt-4">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest opacity-90 pl-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white tracking-tighter drop-shadow-xl">{value}</span>
                        {subtext && <span className="text-sm font-semibold text-slate-500">{subtext}</span>}
                    </div>
                </div>
            </div>

            {/* Bottom shine line */}
            <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${gradients[color].replace('from-', 'from-').split(' ')[0]} opacity-50`}></div>
        </div>
    );
}
