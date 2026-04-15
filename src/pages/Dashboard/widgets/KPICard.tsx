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

    const iconColors = {
        blue: 'text-blue-600 bg-blue-50/80 ring-blue-200',
        emerald: 'text-emerald-600 bg-emerald-50/80 ring-emerald-200',
        amber: 'text-amber-600 bg-amber-50/80 ring-amber-200',
        red: 'text-red-600 bg-red-50/80 ring-red-200',
        indigo: 'text-indigo-600 bg-indigo-50/80 ring-indigo-200',
        purple: 'text-purple-600 bg-purple-50/80 ring-purple-200',
    };

    const accentColors = {
        blue: 'from-blue-400 to-blue-200',
        emerald: 'from-emerald-400 to-emerald-200',
        amber: 'from-amber-400 to-amber-200',
        red: 'from-red-400 to-red-200',
        indigo: 'from-indigo-400 to-indigo-200',
        purple: 'from-purple-400 to-purple-200',
    };

    return (
        <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-md flex flex-col group transition-all duration-300 hover:bg-white hover:shadow-md hover:-translate-y-0.5" style={{ boxShadow: '0 4px 20px -6px rgba(15,23,42,0.10)' }}>

            <div className="relative z-10 p-5 flex flex-col h-full justify-between">

                {/* Header: Icon + Trend */}
                <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl ring-1 ${iconColors[color]} transition-transform duration-300 group-hover:scale-105`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    {trend && (
                        <div className={`
                            flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
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

                {/* Content: Value + Title */}
                <div className="space-y-1 mt-4">
                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900 tracking-tighter">{value}</span>
                        {subtext && <span className="text-sm font-semibold text-slate-400">{subtext}</span>}
                    </div>
                </div>
            </div>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r ${accentColors[color]} opacity-50`} />
        </div>
    );
}
