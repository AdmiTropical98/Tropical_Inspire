import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface GaugeChartProps {
  value: number;
  max: number;
  label?: string;
  subLabel?: string;
}

export function GaugeChart({ value, max, label, subLabel }: GaugeChartProps) {
  const percentage = max > 0 ? Math.min((value / max), 1) : 0;
  
  // SVG arc calculation for half circle
  const radius = 80;
  const strokeWidth = 12; // Thinner stroke for elegant look
  const cx = 100;
  const cy = 100;
  
  // Calculate arc path for the filled part
  const startAngle = Math.PI; // Left side
  const endAngle = Math.PI + (percentage * Math.PI); // Right side based on percentage
  
  const getCoordinatesForAngle = (angle: number) => {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  };

  const start = getCoordinatesForAngle(startAngle);
  const end = getCoordinatesForAngle(endAngle);
  
  const largeArcFlag = percentage > 1 ? 1 : 0;
  
  const filledPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;

  return (
    <div className="relative w-full flex flex-col items-center">
      <div className="relative w-full max-w-[200px] aspect-[2/1] overflow-visible flex justify-center">
        <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
          {/* Background Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#f1f5f9" // Very light slate
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Foreground Arc */}
          {percentage > 0 && (
            <path
              d={filledPath}
              fill="none"
              stroke="#2563eb" // Primary blue
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}
        </svg>
        
        {/* Value Overlay inside gauge arch */}
        {label && (
          <div className="absolute bottom-1 flex flex-col items-center justify-end pb-1 w-full text-center">
            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">{label}</span>
            {subLabel && <span className="text-sm font-bold text-blue-600 mt-1">{subLabel}</span>}
          </div>
        )}
      </div>
      
      {/* Min/Max Labels directly underneath the arc ends */}
      <div className="w-full max-w-[200px] flex justify-between mt-2">
        <span className="text-[11px] font-bold text-slate-400">0 L</span>
        <span className="text-[11px] font-bold text-slate-400">{max.toLocaleString('pt-PT')} L</span>
      </div>
    </div>
  );
}
