import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  subLabel: string;
}

export function GaugeChart({ value, max, label, subLabel }: GaugeChartProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const data = [
    { name: 'Value', value: percentage },
    { name: 'Empty', value: 100 - percentage },
  ];

  return (
    <div className="relative w-full h-48 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="75%" /* Shift down so the half circle is centered */
            startAngle={180}
            endAngle={0}
            innerRadius="75%"
            outerRadius="100%"
            dataKey="value"
            stroke="none"
            cornerRadius={10}
          >
            <Cell key="cell-0" fill="#2563eb" /> {/* Blue */}
            <Cell key="cell-1" fill="#f1f5f9" /> {/* Slate 100 */}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      
      {/* Value Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
        <span className="text-3xl font-black text-slate-900 tracking-tight">{label}</span>
        <span className="text-sm font-bold text-blue-600 mt-1">{subLabel}</span>
      </div>
      
      {/* Min/Max Labels */}
      <div className="absolute bottom-0 w-full flex justify-between px-8">
        <span className="text-xs font-bold text-slate-400">0 L</span>
        <span className="text-xs font-bold text-slate-400">{max.toLocaleString('pt-PT')} L</span>
      </div>
    </div>
  );
}
