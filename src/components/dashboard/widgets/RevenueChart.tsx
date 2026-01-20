import { TrendingUp, BarChart3 } from 'lucide-react';

interface RevenueChartProps {
    data?: number[]; // Array of values for the last 7 days
}

export default function RevenueChart({ data = [45, 60, 75, 50, 80, 95, 70] }: RevenueChartProps) {
    const max = Math.max(...data);
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    return (
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        Serviços Realizados
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Últimos 7 dias</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-white">475</p>
                    <p className="text-xs text-emerald-400 flex items-center justify-end gap-1">
                        <TrendingUp className="w-3 h-3" /> +12%
                    </p>
                </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 mt-2">
                {data.map((value, index) => {
                    const heightPercentage = (value / max) * 100;
                    return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1 group cursor-pointer">
                            <div className="relative w-full bg-slate-800/50 rounded-t-lg h-32 md:h-40 overflow-hidden">
                                <div
                                    className="absolute bottom-0 w-full bg-indigo-500/80 group-hover:bg-indigo-400 transition-all duration-500 rounded-t-lg"
                                    style={{ height: `${heightPercentage}%` }}
                                >
                                    {/* Subtle gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{days[index]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
