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

    const gradients = {
        blue: 'from-blue-100 via-blue-50 to-transparent',
        emerald: 'from-emerald-100 via-emerald-50 to-transparent',
        amber: 'from-amber-100 via-amber-50 to-transparent',
        red: 'from-red-100 via-red-50 to-transparent',
        indigo: 'from-indigo-100 via-indigo-50 to-transparent',
        purple: 'from-purple-100 via-purple-50 to-transparent',
    };

    const iconColors = {
        blue: 'text-blue-600 bg-blue-50 ring-blue-200',
        emerald: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
        amber: 'text-amber-600 bg-amber-50 ring-amber-200',
        red: 'text-red-600 bg-red-50 ring-red-200',
        indigo: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
        purple: 'text-purple-600 bg-purple-50 ring-purple-200',
    };

    return (
        <div className="relative h-full overflow-hidden rounded-3xl bg-white border border-slate-200 flex flex-col group transition-all duration-300 hover:border-slate-300 hover:shadow-xl">

            {/* Ambient Glow */}
            <div className={`absolute top-0 right-0 w-[80%] h-[80%] bg-gradient-to-br ${gradients[color]} blur-3xl opacity-70 group-hover:opacity-90 transition-opacity duration-700 pointer-events-none -mr-10 -mt-10`} />

            <div className="relative z-10 p-6 flex flex-col h-full justify-between">

                {/* Header: Icon + Title */}
                <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl ring-1 ${iconColors[color]} transition-transform duration-300 group-hover:scale-105`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                            ${trendType === 'up' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : ''}
                            ${trendType === 'down' ? 'text-red-700 border-red-200 bg-red-50' : ''}
                            ${trendType === 'neutral' ? 'text-slate-500 border-slate-200 bg-slate-50' : ''}
                        `}>
                            {trendType === 'up' && '↑'}
                            {trendType === 'down' && '↓'}
                            {trend}
                        </div>
                    )}
                </div>

                {/* Content: Value + Subtext */}
                <div className="space-y-1 mt-4">
                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest pl-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-slate-900 tracking-tighter">{value}</span>
                        {subtext && <span className="text-sm font-semibold text-slate-500">{subtext}</span>}
                    </div>
                </div>
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#C9A34E] to-transparent opacity-60"></div>
        </div>
    );
}
