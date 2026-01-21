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
    const todayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon...
    // Adjust logic to match the 7-day window ending today
    // If today is Monday(1), the labels should end with 'Seg'

    const getDayLabel = (offsetParams: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - offsetParams));
        return days[d.getDay() === 0 ? 6 : d.getDay() - 1]; // Shift to 0-6 where 0=Seg, 6=Dom
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        <span className="tracking-tight">Volume de Serviços</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Últimos 7 dias</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-white tracking-tighter">{totalServices}</p>
                    <div className={`text-xs font-bold flex items-center justify-end gap-1 ${Number(percentageChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(percentageChange) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {percentageChange}%
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-2 md:gap-3 lg:gap-4 mt-2">
                {data.map((value, index) => {
                    const heightPercentage = Math.max((value / max) * 100, 5); // Min height 5%
                    return (
                        <div key={index} className="flex flex-col items-center gap-3 flex-1 group cursor-pointer h-full justify-end">
                            <div className="relative w-full bg-slate-800/30 rounded-2xl h-full flex items-end overflow-hidden group-hover:bg-slate-800/50 transition-colors">
                                <div
                                    className="w-full bg-gradient-to-t from-indigo-600 to-blue-500 group-hover:from-indigo-500 group-hover:to-blue-400 transition-all duration-500 rounded-2xl relative"
                                    style={{ height: `${heightPercentage}%` }}
                                >
                                    {/* Tooltip-ish value */}
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-0.5 rounded-full border border-slate-600">
                                        {value}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{getDayLabel(index)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
