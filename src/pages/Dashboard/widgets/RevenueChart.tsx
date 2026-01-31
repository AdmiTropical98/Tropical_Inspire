import { TrendingUp, BarChart3, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';

interface RevenueChartProps {
    services?: any[]; // Pass all services to aggregating inside
}

export default function RevenueChart({ services = [] }: RevenueChartProps) {
    const { data, percentageChange, totalServices } = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d;
        });

        const counts = last7Days.map(date => {
            const dateStr = date.toDateString();
            return services.filter(s => new Date(s.data).toDateString() === dateStr).length;
        });

        const total = counts.reduce((a, b) => a + b, 0);

        // Simple mock Previous Week for trend calculation
        const previousTotal = Math.round(total * 0.9); // Mocking 10% less
        const change = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

        return {
            data: counts,
            percentageChange: change.toFixed(1),
            totalServices: total
        };
    }, [services]);

    const max = Math.max(...data, 1); // Prevent div by zero
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    // Align days label to current week day
    const getDayLabel = (offsetParams: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - offsetParams));
        return days[d.getDay() === 0 ? 6 : d.getDay() - 1]; // Shift to 0-6 where 0=Seg, 6=Dom
    };

    return (
        <div className="relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 h-full flex flex-col shadow-2xl overflow-hidden group">
            {/* Background Details */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none" />

            <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <span className="tracking-tight">Volume de Serviços</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium pl-11">Últimos 7 dias</p>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black text-white tracking-tighter">{totalServices}</p>
                    <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-1 px-2 py-0.5 rounded-full bg-slate-800/50 border border-slate-700/50 ${Number(percentageChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(percentageChange) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {percentageChange}%
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-3 relative z-10">
                {/* Y-Axis Grid Lines effect (implied by flex height) */}
                {data.map((value, index) => {
                    const heightPercentage = Math.max((value / max) * 100, 4); // Min height 4%
                    return (
                        <div key={index} className="flex flex-col items-center gap-3 flex-1 h-full justify-end group/bar">
                            <div className="relative w-full h-full flex items-end justify-center">
                                {/* Bar Track */}
                                <div className="absolute bottom-0 w-2.5 bg-slate-800/50 h-full rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity duration-300" />

                                {/* Actual Bar */}
                                <div
                                    className="w-full max-w-[12px] md:max-w-[24px] bg-gradient-to-t from-indigo-600 via-blue-500 to-cyan-400 rounded-full relative transition-all duration-500 ease-out group-hover/bar:scale-y-105 origin-bottom shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                    style={{ height: `${heightPercentage}%` }}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs font-bold text-white opacity-0 group-hover/bar:opacity-100 transition-all duration-300 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap transform translate-y-2 group-hover/bar:translate-y-0 z-50 pointer-events-none">
                                        {value} svcs
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 group-hover/bar:text-indigo-400 transition-colors uppercase tracking-wider">{getDayLabel(index)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
