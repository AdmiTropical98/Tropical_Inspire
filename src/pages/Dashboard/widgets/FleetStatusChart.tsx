import { useMemo } from 'react';
import { Bus, Wrench, Activity, AlertCircle } from 'lucide-react';

interface FleetStatusChartProps {
    total: number;
    available: number;
    maintenance: number;
    active: number;
}

export default function FleetStatusChart({ total, available, maintenance, active }: FleetStatusChartProps) {
    const data = useMemo(() => {
        return [
            { label: 'Disponível', value: available, color: '#10b981', icon: Bus }, // Emerald-500
            { label: 'Em Serviço', value: active, color: '#f59e0b', icon: Activity }, // Amber-500
            { label: 'Oficina', value: maintenance, color: '#ef4444', icon: Wrench }, // Red-500
        ].filter(d => d.value > 0);
    }, [available, maintenance, active]);

    // SVG Donut Logic
    const size = 160;
    const strokeWidth = 12;
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full flex flex-col relative overflow-hidden shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)]">
            <h3 className="text-slate-900 font-bold text-lg mb-6 flex items-center gap-2">
                <Bus className="w-5 h-5 text-blue-500" />
                Estado da Frota
            </h3>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 flex-1">
                {/* Donut Chart */}
                <div className="relative flex items-center justify-center">
                    <svg width={size} height={size} className="transform -rotate-90">
                        {/* Background Circle */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke="#E2E8F0"
                            strokeWidth={strokeWidth}
                        />
                        {/* Segments */}
                        {data.map((item, index) => {
                            const percentage = (item.value / total);
                            const dashArray = percentage * circumference;
                            const offset = accumulatedOffset;
                            accumulatedOffset += dashArray; // Important: subtract for clockwise, but default SVG stroke is typically handled differently. 
                            // Actually stroke-dashoffset needs to accumulate negatively for clockwise

                            return (
                                <circle
                                    key={index}
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    fill="transparent"
                                    stroke={item.color}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                                    strokeDashoffset={- (offset)}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            );
                        })}
                    </svg>

                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold text-slate-900">{total}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total</span>
                    </div>
                </div>

                {/* Custom Legend */}
                <div className="flex-1 w-full space-y-3">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-50 text-white" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                                    <p className="text-xs text-slate-500 font-medium">{((item.value / total) * 100).toFixed(1)}%</p>
                                </div>
                            </div>
                            <span className="font-bold text-slate-900">{item.value}</span>
                        </div>
                    ))}
                    {data.length === 0 && (
                        <div className="flex flex-col items-center justify-center text-slate-500 text-sm py-4">
                            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                            Sem dados de frota
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
