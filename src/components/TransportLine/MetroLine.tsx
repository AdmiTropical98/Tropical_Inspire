import React from 'react';
import { Truck } from 'lucide-react';
import type { RouteStop } from '../../utils/geoUtils';

export interface VehicleMarker {
  id: string;
  label: string;
  currentSegmentIndex: number;
  progressInSegment: number;
  status?: string;
}

interface MetroLineProps {
  stops: RouteStop[];
  vehicles: VehicleMarker[];
}

const MetroLine: React.FC<MetroLineProps> = ({ stops, vehicles }) => {
  if (!stops || stops.length === 0) {
    return <div className="p-12 text-slate-500 text-center bg-slate-900/20 rounded-2xl border border-slate-800/50 italic">Sem paragens configuradas no roteiro.</div>;
  }

  const numStops = stops.length;
  const svgWidth = Math.max(800, numStops * 180);
  const svgHeight = 180;
  
  const paddingX = 80;
  const lineY = 90;
  
  const usableWidth = svgWidth - (paddingX * 2);
  const segmentWidth = numStops > 1 ? usableWidth / (numStops - 1) : 0;

  return (
    <div className="w-full overflow-x-auto bg-[#0a0f1d] rounded-xl border border-slate-800/60 p-8 custom-scrollbar">
      <div className="inline-block min-w-full">
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="mx-auto overflow-visible">
          {/* Subtle horizontal grid guide */}
          <line x1="0" y1={lineY} x2={svgWidth} y2={lineY} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

          {/* Connection Lines (Base and Progress) */}
          {numStops > 1 && (
            <>
              {/* Base Path (Grey) */}
              <line 
                x1={paddingX} 
                y1={lineY} 
                x2={svgWidth - paddingX} 
                y2={lineY} 
                stroke="#1e293b" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
              
              {/* Active Progress Path */}
              {vehicles.map(v => {
                const headX = paddingX + (v.currentSegmentIndex * segmentWidth) + (v.progressInSegment * segmentWidth);
                return (
                  <line 
                    key={`line-${v.id}`}
                    x1={paddingX} 
                    y1={lineY} 
                    x2={headX} 
                    y2={lineY} 
                    stroke="#3b82f6" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                );
              })}
            </>
          )}

          {/* Stops */}
          {stops.map((stop, index) => {
            const stopX = paddingX + (index * segmentWidth);
            const isPassed = vehicles.some(v => v.currentSegmentIndex >= index);
            const isCurrent = vehicles.some(v => v.currentSegmentIndex === index);
            
            return (
              <g key={stop.id} transform={`translate(${stopX}, ${lineY})`}>
                {/* Time Indicator (minimalist) */}
                {index < numStops - 1 && stop.timeToNext && (
                  <text 
                    x={segmentWidth / 2} 
                    y="-15" 
                    fill="#475569" 
                    fontSize="10" 
                    fontWeight="600" 
                    textAnchor="middle" 
                    className="font-sans tracking-wide"
                  >
                    {stop.timeToNext}
                  </text>
                )}

                {/* Stop Dot */}
                <circle 
                  r="6" 
                  fill={isPassed ? "#3b82f6" : "#0a0f1d"} 
                  stroke={isPassed ? "#3b82f6" : "#334155"} 
                  strokeWidth="2" 
                />
                {isCurrent && (
                  <circle r="12" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 2" className="animate-spin-slow" />
                )}

                {/* Stop Name */}
                <text 
                  y="25" 
                  textAnchor="middle"
                  fill={isPassed ? "#e2e8f0" : "#64748b"}
                  fontSize="11" 
                  fontWeight={isPassed ? "600" : "500"}
                  className="font-sans uppercase tracking-tighter"
                >
                  {stop.name}
                </text>
              </g>
            );
          })}

          {/* Vehicles (Dashboard Style) */}
          {vehicles.map((v, idx) => {
            const truckX = paddingX + (v.currentSegmentIndex * segmentWidth) + (v.progressInSegment * segmentWidth);
            const offsetIdx = vehicles.filter((vOther, i) => i < idx && Math.abs(vOther.currentSegmentIndex + vOther.progressInSegment - (v.currentSegmentIndex + v.progressInSegment)) < 0.05).length;
            const yOffset = offsetIdx * 15;

            return (
              <g 
                key={v.id} 
                transform={`translate(${truckX}, ${lineY - 35 - yOffset})`} 
                className="transition-all duration-1000 ease-linear"
              >
                {/* Minimalist Vehicle Card */}
                <rect x="-35" y="-14" width="70" height="28" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="1" />
                
                {/* Icon Section */}
                <rect x="-35" y="-14" width="24" height="28" rx="4" fill="#3b82f6" />
                <foreignObject x="-31" y="-10" width="16" height="16">
                  <div className="text-white flex items-center justify-center">
                    <Truck size={14} />
                  </div>
                </foreignObject>

                {/* Label Section */}
                <text x="18" y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" className="font-sans">
                  {v.label}
                </text>

                {/* Connector Line to path */}
                <line x1="0" y1="14" x2="0" y2="35" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="2 2" />
                <circle cx="0" cy="35" r="3" fill="#3b82f6" />

                {/* Live Pulse for moving vehicles */}
                {v.status === 'moving' && (
                  <circle cx="-23" cy="-14" r="4" fill="#22c55e" stroke="#0a0f1d" strokeWidth="2" className="animate-pulse" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default MetroLine;

